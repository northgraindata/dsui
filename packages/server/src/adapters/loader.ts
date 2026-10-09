import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
  AdapterInfo,
  PageDocument,
  StorePersistenceProvider,
} from "@northgraindata/dsui-adapter-sdk";
import type { HealthStatus } from "@northgraindata/dsui-core";
import {
  type AdapterBuildPhase,
  type AdapterSourceLocation,
  buildAdapter,
} from "./build.js";
import { assertAdapterDefinition } from "./definition.js";
import type { AdapterFetch } from "./fetch.js";
import { AdapterHostClient } from "./host.js";
import { resolveSdkRoot } from "./sdk.js";
import type {
  AdapterBackend,
  AdapterCatalog,
  AdapterExecutionContext,
  JobCatalogEntry,
  LoadedAdapter,
  LoadedConnectionMethod,
  SignalCatalogEntry,
} from "./types.js";
import { AdapterExecutionError, AdapterLoadError } from "./types.js";

export interface AdapterLoadOptions {
  dataDir?: string;
  fetch?: AdapterFetch;
  /** Reuse the stored bundle and never open the network. */
  offline?: boolean;
  /** Subprocess host factory; callers can inject a controlled host. */
  spawnHost?: (bundlePath: string) => {
    request(request: {
      method: "describe" | "health" | "page" | "resource" | "action" | "job";
      connection?: unknown;
      target?: string;
      input?: unknown;
      persistenceNamespace?: string;
      runId?: string;
      signal?: AbortSignal;
      timeoutMs?: number;
    }): Promise<unknown>;
  };
  /** Host call budget in ms (actions run long). */
  hostTimeoutMs?: number;
  /** Creates a durable provider scoped to one DSUI service. */
  persistenceProvider?: (namespace: string) => StorePersistenceProvider;
  /** SQLite path passed to isolated adapter hosts. */
  persistenceDatabasePath?: string;
  /** Version stamped on the adapter SDK; defaults to the running DSUI. */
  version?: string;
  /** Called as an adapter build moves between phases. */
  onPhase?: (phase: AdapterBuildPhase) => void;
}

export { assertAdapterDefinition } from "./definition.js";

function healthy(started: number): HealthStatus {
  return {
    status: "healthy",
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
  };
}

function unhealthy(started: number, error: unknown): HealthStatus {
  return {
    status: "unavailable",
    checkedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
    detail: error instanceof Error ? error.message : "Health probe failed",
    score: 0,
    checks: [
      {
        id: "reachability",
        label: "Service reachable",
        ok: false,
        detail: error instanceof Error ? error.message : "Health probe failed",
      },
    ],
  };
}

function assertHealthReport(
  value: unknown,
  fallbackLatencyMs: number,
): HealthStatus {
  const report = value as {
    status?: unknown;
    score?: unknown;
    latencyMs?: unknown;
    checks?: unknown;
  };
  const rawScore = typeof report.score === "number" ? report.score : undefined;
  const score =
    rawScore === undefined || !Number.isFinite(rawScore)
      ? undefined
      : Math.min(100, Math.max(0, Math.round(rawScore)));
  const status =
    report.status === "healthy" ||
    report.status === "warning" ||
    report.status === "unavailable" ||
    report.status === "unknown"
      ? report.status
      : "unknown";
  const checks = Array.isArray(report.checks)
    ? report.checks.flatMap((entry) => {
        const check = entry as {
          id?: unknown;
          label?: unknown;
          ok?: unknown;
          detail?: unknown;
        };
        if (typeof check?.id !== "string" || typeof check.ok !== "boolean")
          return [];
        return [
          {
            id: check.id,
            label: typeof check.label === "string" ? check.label : check.id,
            ok: check.ok,
            ...(typeof check.detail === "string"
              ? { detail: check.detail }
              : {}),
          },
        ];
      })
    : undefined;
  return {
    status,
    checkedAt: new Date().toISOString(),
    latencyMs:
      typeof report.latencyMs === "number" && Number.isFinite(report.latencyMs)
        ? report.latencyMs
        : fallbackLatencyMs,
    ...(score !== undefined ? { score } : {}),
    ...(checks !== undefined ? { checks } : {}),
  };
}

function assertCatalog(value: unknown, from: string): AdapterCatalog {
  if (!value || typeof value !== "object")
    throw new AdapterLoadError(`Invalid adapter catalog from ${from}`);
  const catalog = value as Record<string, unknown>;
  for (const key of ["resources", "actions", "pages", "components"] as const) {
    if (!Array.isArray(catalog[key]))
      throw new AdapterLoadError(`Invalid adapter catalog from ${from}`);
  }
  for (const key of ["resources", "actions"] as const) {
    const entries = catalog[key];
    if (!Array.isArray(entries))
      throw new AdapterLoadError(`Invalid adapter catalog from ${from}`);
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof entry.id !== "string" ||
        !entry.id
      )
        throw new AdapterLoadError(`Invalid adapter ${key} from ${from}`);
      if (
        entry.description !== undefined &&
        typeof entry.description !== "string"
      )
        throw new AdapterLoadError(
          `Invalid adapter discovery description from ${from}`,
        );
      if (
        key === "resources" &&
        entry.policy !== undefined &&
        !["metadata", "preview", "sql"].includes(entry.policy)
      )
        throw new AdapterLoadError(
          `Invalid adapter resource policy from ${from}`,
        );
    }
  }
  const signals = Array.isArray(catalog.signals) ? catalog.signals : [];
  for (const entry of signals) {
    if (!entry || typeof entry !== "object")
      throw new AdapterLoadError(`Invalid adapter signals from ${from}`);
    const signal = entry as Record<string, unknown>;
    if (
      typeof signal.id !== "string" ||
      (signal.type !== "info" &&
        signal.type !== "success" &&
        signal.type !== "warning" &&
        signal.type !== "error") ||
      !signal.schema ||
      typeof signal.schema !== "object"
    )
      throw new AdapterLoadError(`Invalid adapter signals from ${from}`);
  }
  return {
    ...catalog,
    jobs: Array.isArray(catalog.jobs) ? catalog.jobs : [],
    signals,
  } as AdapterCatalog;
}

function assertHealthStatus(value: unknown, from: string): HealthStatus {
  if (!value || typeof value !== "object")
    throw new AdapterLoadError(`Invalid health status from ${from}`);
  return assertHealthReport(value, 0);
}

type RemoteHostRequest = {
  method: "describe" | "health" | "page" | "resource" | "action" | "job";
  connection?: unknown;
  target?: string;
  input?: unknown;
  persistenceNamespace?: string;
  runId?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type RemoteHost = {
  request(request: RemoteHostRequest): Promise<unknown>;
};

const serialRequestQueues = new Map<string, Promise<void>>();

function queueSerialRequest(
  key: string,
  request: () => Promise<unknown>,
): Promise<unknown> {
  const result = (serialRequestQueues.get(key) ?? Promise.resolve()).then(
    request,
  );
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  serialRequestQueues.set(key, tail);
  void tail.then(() => {
    if (serialRequestQueues.get(key) === tail) serialRequestQueues.delete(key);
  });
  return result;
}

export class RemoteBackend implements AdapterBackend {
  constructor(
    private readonly host: RemoteHost,
    private readonly adapterId: string,
    private readonly connectionMethods: readonly Pick<
      LoadedConnectionMethod,
      "id" | "requestConcurrency"
    >[],
  ) {}

  private request(request: RemoteHostRequest): Promise<unknown> {
    const connection = request.connection;
    const methodId =
      connection && typeof connection === "object" && "method" in connection
        ? (connection as { method?: unknown }).method
        : this.connectionMethods.length === 1
          ? this.connectionMethods[0].id
          : undefined;
    if (typeof methodId !== "string") return this.host.request(request);
    const method = this.connectionMethods.find(({ id }) => id === methodId);
    if (!method || method.requestConcurrency !== "serial")
      return this.host.request(request);

    return queueSerialRequest(`${this.adapterId}:${method.id}`, () =>
      this.host.request(request),
    );
  }

  validateConnection(connection: unknown): unknown {
    // Remote schemas live in the bundle; the host validates per call.
    return connection;
  }

  async checkHealth(
    connection: unknown,
    context?: AdapterExecutionContext,
  ): Promise<HealthStatus> {
    const started = Date.now();
    try {
      const status = assertHealthStatus(
        await this.request({
          method: "health",
          connection,
          persistenceNamespace: context?.persistenceNamespace,
        }),
        "adapter host",
      );
      return { ...status, latencyMs: status.latencyMs ?? Date.now() - started };
    } catch (error) {
      return unhealthy(started, error);
    }
  }

  async renderPage(
    connection: unknown,
    path: string,
    context?: AdapterExecutionContext,
  ): Promise<PageDocument> {
    const result = await this.request({
      method: "page",
      connection,
      input: { path },
      persistenceNamespace: context?.persistenceNamespace,
    });
    if (!result || typeof result !== "object")
      throw new AdapterExecutionError("Adapter host returned an invalid page");
    return result as PageDocument;
  }

  async executeResource(
    resourceId: string,
    connection: unknown,
    input: unknown,
    context?: AdapterExecutionContext,
  ): Promise<{ data: unknown }> {
    try {
      const result = (await this.request({
        method: "resource",
        connection,
        target: resourceId,
        input,
        persistenceNamespace: context?.persistenceNamespace,
      })) as { data?: unknown };
      return { data: result?.data };
    } catch (error) {
      throw new AdapterExecutionError(
        error instanceof Error ? error.message : "Resource execution failed",
      );
    }
  }

  async executeAction(
    actionId: string,
    connection: unknown,
    input: unknown,
    _signal?: AbortSignal,
    context?: AdapterExecutionContext,
  ): Promise<{
    result:
      | { status: "success"; data: unknown }
      | { status: "error"; message: string };
    emissions: readonly {
      signalId: string;
      payload: unknown;
      idempotencyKey?: string;
    }[];
  }> {
    const result = (await this.request({
      method: "action",
      connection,
      target: actionId,
      input,
      persistenceNamespace: context?.persistenceNamespace,
    })) as {
      result?: unknown;
      emissions?: unknown;
    };
    if (
      !result ||
      typeof result !== "object" ||
      !result.result ||
      !Array.isArray(result.emissions)
    )
      throw new AdapterExecutionError("Adapter host returned no result");
    const actionResult = result.result as Record<string, unknown>;
    if (
      (actionResult.status !== "success" && actionResult.status !== "error") ||
      (actionResult.status === "success" && !("data" in actionResult)) ||
      (actionResult.status === "error" &&
        typeof actionResult.message !== "string")
    )
      throw new AdapterExecutionError(
        "Adapter host returned an invalid action result",
      );
    const emissions = result.emissions.map((entry) => {
      if (!entry || typeof entry !== "object")
        throw new AdapterExecutionError(
          "Adapter host returned an invalid action signal",
        );
      const emission = entry as Record<string, unknown>;
      if (
        typeof emission.signalId !== "string" ||
        !("payload" in emission) ||
        (emission.idempotencyKey !== undefined &&
          typeof emission.idempotencyKey !== "string")
      )
        throw new AdapterExecutionError(
          "Adapter host returned an invalid action signal",
        );
      return {
        signalId: emission.signalId,
        payload: emission.payload,
        ...(typeof emission.idempotencyKey === "string"
          ? { idempotencyKey: emission.idempotencyKey }
          : {}),
      };
    });
    return {
      result: actionResult as
        | { status: "success"; data: unknown }
        | { status: "error"; message: string },
      emissions,
    };
  }

  async executeJob(
    jobId: string,
    connection: unknown,
    input: unknown,
    options: { runId: string; signal: AbortSignal; timeoutMs: number },
    context?: AdapterExecutionContext,
  ): Promise<
    readonly { signalId: string; payload: unknown; idempotencyKey?: string }[]
  > {
    const result = await this.request({
      method: "job",
      connection,
      target: jobId,
      input,
      runId: options.runId,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      persistenceNamespace: context?.persistenceNamespace,
    });
    if (!Array.isArray(result))
      throw new AdapterExecutionError(
        "Adapter host returned invalid job signals",
      );
    return result.map((entry) => {
      if (!entry || typeof entry !== "object")
        throw new AdapterExecutionError(
          "Adapter host returned an invalid signal",
        );
      const emission = entry as Record<string, unknown>;
      if (
        typeof emission.signalId !== "string" ||
        (emission.idempotencyKey !== undefined &&
          typeof emission.idempotencyKey !== "string") ||
        !("payload" in emission)
      )
        throw new AdapterExecutionError(
          "Adapter host returned an invalid signal",
        );
      return {
        signalId: emission.signalId,
        payload: emission.payload,
        ...(typeof emission.idempotencyKey === "string"
          ? { idempotencyKey: emission.idempotencyKey }
          : {}),
      };
    });
  }
}

/**
 * Command that runs one adapter-host subprocess for a built bundle.
 *
 * Three ways DSUI can be running, and the host has to be reached differently in
 * each: a source checkout has `adapter-host.ts` on disk, a compiled binary
 * re-enters itself, and a bundled `server.mjs` has to be named as the script
 * for bun. Mode is taken from what exists on disk rather than argv, which
 * cannot distinguish normal CLI execution from adapter-host mode.
 */
export function defaultHostCommand(
  bundlePath: string,
  databasePath?: string,
): {
  command: string;
  args: string[];
} {
  const hostArgs = [
    "adapter-host",
    "--bundle",
    bundlePath,
    ...(databasePath ? ["--database", databasePath] : []),
  ];
  for (const candidate of [
    fileURLToPath(new URL("../adapter-host.ts", import.meta.url)),
    fileURLToPath(import.meta.url),
  ])
    if (existsSync(candidate))
      return { command: process.execPath, args: [candidate, ...hostArgs] };
  // Compiled binary: its own image is not on disk, so it re-enters itself.
  return { command: process.execPath, args: hostArgs };
}

function toConnectionMethods(
  value: unknown,
): LoadedConnectionMethod[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((method) => {
    const entry = method as LoadedConnectionMethod;
    return {
      id: entry.id,
      label: entry.label,
      ...(entry.description ? { description: entry.description } : {}),
      requestConcurrency:
        entry.requestConcurrency === "serial" ? "serial" : "parallel",
      schema: entry.schema ?? {},
      ...(entry.group ? { group: { ...entry.group } } : {}),
    };
  });
}

/**
 * Builds one adapter from source and prepares it to serve.
 *
 * There is one path for every adapter: source is materialized, bundled, and run
 * in an `adapter-host` subprocess. Whether the source is a directory in this
 * repository or a subdirectory on GitHub, the result is identical.
 */
export async function loadAdapter(
  id: string,
  source: AdapterSourceLocation,
  options: AdapterLoadOptions = {},
): Promise<LoadedAdapter> {
  const dataDir = options.dataDir;
  if (!dataDir)
    throw new AdapterLoadError("Adapter loading requires a data directory");

  const built = await buildAdapter(id, source, {
    dataDir,
    sdkPackageRoot: await resolveSdkRoot({
      dataDir,
      version: options.version ?? process.env.DSUI_VERSION ?? "0.0.0",
    }),
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.offline ? { offline: options.offline } : {}),
    ...(options.onPhase ? { onPhase: options.onPhase } : {}),
  }).catch((error: unknown) => {
    throw new AdapterLoadError(
      `Cannot build adapter "${id}": ${error instanceof Error ? error.message : "build failed"}`,
    );
  });

  const spawn =
    options.spawnHost ??
    ((bundlePath: string) => {
      const { command, args } = defaultHostCommand(
        bundlePath,
        options.persistenceDatabasePath,
      );
      return new AdapterHostClient({
        command,
        args,
        timeoutMs: options.hostTimeoutMs ?? 600_000,
      });
    });
  const host = spawn(built.bundlePath);
  const described = (await host
    .request({ method: "describe" })
    .catch((error: unknown) => {
      throw new AdapterLoadError(
        `Adapter host describe failed for "${id}": ${error instanceof Error ? error.message : "unknown error"}`,
      );
    })) as {
    metadata?: AdapterInfo;
    connectionSchema?: LoadedAdapter["connectionSchema"];
    connectionMethods?: unknown;
    resources?: AdapterCatalog["resources"];
    actions?: AdapterCatalog["actions"];
    pages?: AdapterCatalog["pages"];
    components?: AdapterCatalog["components"];
    jobs?: JobCatalogEntry[];
    signals?: SignalCatalogEntry[];
  };
  const catalog = assertCatalog(described, built.bundlePath);
  const metadata = described.metadata;
  if (!metadata || metadata.id !== id)
    throw new AdapterLoadError(
      `Adapter declares id "${metadata?.id ?? "?"}" but is registered as "${id}"`,
    );
  const connectionMethods = toConnectionMethods(described.connectionMethods);
  return {
    id,
    metadata: { ...metadata },
    catalog: {
      resources: catalog.resources,
      actions: catalog.actions,
      pages: catalog.pages,
      components: built.components ?? [],
      jobs: catalog.jobs,
      signals: catalog.signals,
    },
    ...(described.connectionSchema
      ? { connectionSchema: described.connectionSchema }
      : {}),
    ...(connectionMethods ? { connectionMethods } : {}),
    backend: new RemoteBackend(host, id, connectionMethods ?? []),
    ...(built.browserBundlePath
      ? { browserBundlePath: built.browserBundlePath }
      : {}),
  };
}
