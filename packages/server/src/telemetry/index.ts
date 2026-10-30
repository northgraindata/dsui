import { randomUUID } from "node:crypto";
import { arch, platform } from "node:os";
import { z } from "zod";
import type { DsuiDatabase } from "../db/database";
import { readSettings, writeSettings } from "../db/settings";

/**
 * Anonymous, aggregate usage telemetry for self-hosted installs.
 *
 * It is sent to the DSUI cloud API relay, never to PostHog directly, so an OSS
 * server carries no analytics key. The payload is the whole contract: every
 * field is listed in `telemetryEventSchema` and documented in
 * `apps/docs/content/docs/telemetry.mdx`.
 */

/** Relay that validates, rate-limits and forwards events. Override with DSUI_TELEMETRY_URL. */
export const DEFAULT_TELEMETRY_URL =
  "https://cloud.dsui.northgraindata.com/telemetry/v1";

const SEND_TIMEOUT_MS = 3_000;
const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Adapter ids reported by name. A service can use a community adapter whose id
 * the operator chose, which can identify them, so anything else is "other".
 */
const KNOWN_ADAPTERS = [
  "airflow",
  "clickhouse",
  "dbt",
  "duckdb",
  "postgresql",
  "s3",
  "trino",
] as const;

/** First-party plugins reported by name; any other package counts as "other". */
const KNOWN_PLUGINS = [
  "ai-agent",
  "ai-diagnostics-pro",
  "auth-pro",
  "code-repository",
  "health",
  "monitoring",
  "notifications-pro",
] as const;
const PLUGIN_PACKAGE_PREFIX = "@northgraindata/dsui-plugin-";

/** Audit actions counted as usage. Reads are not audited, so they are not counted. */
const USAGE_ACTIONS = {
  "action.execute": "actionsExecuted",
  "plugin.procedure.execute": "pluginProcedures",
  "service.create": "servicesCreated",
} as const;
const MAX_USAGE_KEYS = 8;
const MAX_ERROR_KEYS = 32;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const telemetryEventSchema = z
  .object({
    event: z.enum(["server_started", "server_heartbeat"]),
    installId: z.string().uuid(),
    version: z.string().max(40),
    os: z.string().max(20),
    arch: z.string().max(20),
    runtime: z.string().max(40),
    deployment: z.enum(["docker", "managed", "other"]),
    serviceCounts: z.record(z.number().int().min(0)),
    pluginCount: z.number().int().min(0),
    pluginKinds: z.record(z.number().int().min(0)),
    usage24h: z
      .record(z.number().int().min(0))
      .refine((usage) => Object.keys(usage).length <= MAX_USAGE_KEYS),
    installAgeDays: z.number().int().min(0),
    ci: z.boolean(),
    errors: z
      .record(z.number().int().min(0))
      .refine((errors) => Object.keys(errors).length <= MAX_ERROR_KEYS),
  })
  .strict();

export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Whether telemetry may be sent.
 *
 * Any single opt-out wins: DSUI_TELEMETRY=off, DO_NOT_TRACK=1, or
 * `telemetry.enabled: false` in the config file.
 */
export function telemetryEnabled(
  env: Env,
  config?: { telemetry?: { enabled?: boolean } },
): boolean {
  const flag = env.DSUI_TELEMETRY?.trim().toLowerCase();
  if (flag === "off" || flag === "0" || flag === "false") return false;
  const dnt = env.DO_NOT_TRACK?.trim().toLowerCase();
  if (dnt === "1" || dnt === "true") return false;
  return config?.telemetry?.enabled !== false;
}

const installSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime().optional(),
});

/** Random per-install id and when it was made, created on first use and stored in the settings table. */
export function readInstall(
  database: DsuiDatabase,
): z.infer<typeof installSchema> {
  const read = () =>
    readSettings(database.sqlite, "telemetry", "install", installSchema, {
      id: "",
    });
  const stored = read();
  if (stored.revision > 0) return stored.value;
  writeSettings(
    database.sqlite,
    "telemetry",
    "install",
    { id: randomUUID(), createdAt: new Date().toISOString() },
    0,
  );
  // A concurrent writer may have won the compare-and-swap, so read back.
  return read().value;
}

export function readInstallId(database: DsuiDatabase): string {
  return readInstall(database).id;
}

export function installAgeDays(
  createdAt: string | undefined,
  now = Date.now(),
) {
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((now - Date.parse(createdAt)) / MS_PER_DAY));
}

/** Counts of audited actions in the last 24 hours, under fixed names. */
export function countUsage(
  database: DsuiDatabase,
  now = Date.now(),
): Record<string, number> {
  const since = new Date(now - MS_PER_DAY).toISOString();
  const usage: Record<string, number> = {};
  for (const name of Object.values(USAGE_ACTIONS)) usage[name] = 0;
  const rows = database.sqlite
    .query<{ action: string; total: number }, [string]>(
      "SELECT action, COUNT(*) AS total FROM audit_events WHERE at >= ? GROUP BY action",
    )
    .all(since);
  for (const row of rows) {
    const name = USAGE_ACTIONS[row.action as keyof typeof USAGE_ACTIONS];
    if (name) usage[name] = row.total;
  }
  return usage;
}

/** Counts plugin packages by first-party name; everything else is "other". */
export function countPluginKinds(packages: Iterable<string>) {
  const counts: Record<string, number> = {};
  for (const name of packages) {
    const short = name.startsWith(PLUGIN_PACKAGE_PREFIX)
      ? name.slice(PLUGIN_PACKAGE_PREFIX.length)
      : "";
    const key = (KNOWN_PLUGINS as readonly string[]).includes(short)
      ? short
      : "other";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * "managed" marks instances run by DSUI Cloud. The relay only believes it when
 * the request also carries the cloud-issued DSUI_TELEMETRY_TOKEN.
 */
export function deploymentKind(
  value: string | undefined,
): TelemetryEvent["deployment"] {
  return value === "docker" || value === "managed" ? value : "other";
}

/** A built-in adapter's name, or "other": a community adapter's id can identify its operator. */
export function adapterBucket(adapter: string): string {
  return (KNOWN_ADAPTERS as readonly string[]).includes(adapter)
    ? adapter
    : "other";
}

export function countServicesByAdapter(
  adapters: Iterable<string>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const adapter of adapters) {
    const key = adapterBucket(adapter);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** CI runners and throwaway containers mint a new install id on every run. */
function isCi(env: Env): boolean {
  const value = env.CI?.trim().toLowerCase();
  return (
    value !== undefined && value !== "" && value !== "0" && value !== "false"
  );
}

export type TelemetryOptions = {
  installId: string;
  version: string;
  env?: Env;
  url?: string;
  /** Injectable for tests, like the adapter and plugin installers. */
  fetch?: typeof fetch;
  /** Current usage snapshot, read each time an event is built. */
  snapshot: () => {
    serviceAdapters: Iterable<string>;
    pluginPackages: Iterable<string>;
    usage: Record<string, number>;
    /** Faults since the previous report, by category and built-in adapter. */
    errors: Record<string, number>;
    installCreatedAt: string | undefined;
  };
};

export type Telemetry = {
  start(): void;
  stop(): void;
};

export function createTelemetry(options: TelemetryOptions): Telemetry {
  const env = options.env ?? process.env;
  const url = options.url ?? env.DSUI_TELEMETRY_URL ?? DEFAULT_TELEMETRY_URL;
  const send = options.fetch ?? fetch;
  let timer: ReturnType<typeof setInterval> | undefined;

  const build = (event: TelemetryEvent["event"]): TelemetryEvent => {
    const snapshot = options.snapshot();
    const pluginPackages = [...snapshot.pluginPackages];
    return telemetryEventSchema.parse({
      event,
      installId: options.installId,
      version: options.version,
      os: platform(),
      arch: arch(),
      runtime: `bun ${Bun.version}`,
      deployment: deploymentKind(env.DSUI_DEPLOYMENT),
      serviceCounts: countServicesByAdapter(snapshot.serviceAdapters),
      pluginCount: pluginPackages.length,
      pluginKinds: countPluginKinds(pluginPackages),
      usage24h: snapshot.usage,
      errors: snapshot.errors,
      installAgeDays: installAgeDays(snapshot.installCreatedAt),
      ci: isCi(env),
    });
  };

  // Telemetry must never affect the server, so a failed send is dropped. The
  // timeout bounds how long a dead relay can hold a socket open.
  const emit = async (event: TelemetryEvent["event"]): Promise<void> => {
    try {
      await send(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(env.DSUI_TELEMETRY_TOKEN
            ? { authorization: `Bearer ${env.DSUI_TELEMETRY_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(build(event)),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch {
      // Intentionally ignored; see above.
    }
  };

  return {
    start() {
      if (timer) return;
      void emit("server_started");
      timer = setInterval(
        () => void emit("server_heartbeat"),
        HEARTBEAT_INTERVAL_MS,
      );
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}
