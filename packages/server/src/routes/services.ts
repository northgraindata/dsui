import { randomUUID } from "node:crypto";
import type { PageDocument } from "@northgraindata/dsui-adapter-sdk";
import type { HealthStatus, PublicService } from "@northgraindata/dsui-core";
import type { Hono } from "hono";
import { z } from "zod";
import type { AdapterRegistry } from "../adapters/registry.js";
import { allowed } from "../auth.js";
import type { ConfiguredService, DsuiConfig } from "../config.js";
import type { ConnectionCipher } from "../db/crypto.js";
import type { DsuiDatabase, UiServiceRow } from "../db/database.js";
import type { SignalBus } from "../events/signal-bus.js";
import type { PluginRuntime } from "../plugins/runtime.js";
import { errorMessage, httpStatus } from "./errors.js";

// Keep one stalled adapter from holding a service response open.
const SERVICE_HEALTH_TIMEOUT_MS = 8_000;
// A health result is reused this long, so listing services never waits on a
// slow adapter (for example a cold remote warehouse connection) once measured.
const HEALTH_TTL_MS = 30_000;

interface HealthEntry {
  status: HealthStatus;
  measuredAt: number;
  pending?: Promise<void>;
}

function unmeasured(
  status: "unknown" | "unavailable",
  detail?: string,
): HealthStatus {
  return {
    status,
    checkedAt: new Date().toISOString(),
    ...(detail ? { detail } : {}),
  };
}

const healthCache = new WeakMap<ServiceDeps, Map<string, HealthEntry>>();

type Adapter = ReturnType<AdapterRegistry["get"]>;

function startHealthRefresh(
  entries: Map<string, HealthEntry>,
  id: string,
  adapter: Adapter,
  connection: ReturnType<typeof connectionFor>,
): Promise<void> {
  const existing = entries.get(id);
  if (existing?.pending) return existing.pending;
  const entry: HealthEntry = existing ?? {
    status: unmeasured("unknown"),
    measuredAt: 0,
  };
  entries.set(id, entry);
  entry.pending = adapter.backend
    .checkHealth(connection, {
      persistenceNamespace: id,
      timeoutMs: SERVICE_HEALTH_TIMEOUT_MS,
    })
    .then((status) => {
      entry.status = status;
      entry.measuredAt = Date.now();
    })
    .catch((error: unknown) => {
      entry.status = unmeasured("unavailable", errorMessage(error));
      entry.measuredAt = Date.now();
    })
    .finally(() => {
      entry.pending = undefined;
    });
  return entry.pending;
}

/**
 * Stale-while-revalidate health: fresh results are served as-is, stale ones are
 * served while a refresh runs; only a never-measured service waits.
 */
async function serviceHealth(
  deps: ServiceDeps,
  id: string,
  adapter: Adapter,
  connection: ReturnType<typeof connectionFor>,
  waitForResult: boolean,
): Promise<HealthStatus> {
  let entries = healthCache.get(deps);
  if (!entries) {
    entries = new Map();
    healthCache.set(deps, entries);
  }
  const entry = entries.get(id);
  if (entry && Date.now() - entry.measuredAt < HEALTH_TTL_MS && !waitForResult)
    return entry.status;
  const refresh = startHealthRefresh(entries, id, adapter, connection);
  const current = entries.get(id);
  // An unmeasured service waits for its first result: nothing re-reads the list
  // to replace an `unknown` placeholder (the health timeout still bounds it).
  if (waitForResult || !current || current.measuredAt === 0) await refresh;
  return entries.get(id)?.status ?? unmeasured("unknown");
}

export const createServiceSchema = z.object({
  adapter: z.string().min(1),
  name: z.string().min(1).max(120),
  connection: z.record(z.unknown()).default({}),
});

export type ServiceSource =
  | { service: ConfiguredService; managedBy: "configuration" }
  | { service: UiServiceRow; managedBy: "ui" };

function withBrowserComponents(
  document: PageDocument,
  browserUrl: string | undefined,
): PageDocument {
  if (!browserUrl) return document;
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    const record = value as Record<string, unknown>;
    if (
      typeof record.kind === "string" &&
      record.props &&
      typeof record.props === "object"
    ) {
      const props = visit(record.props) as Record<string, unknown>;
      return record.kind === "custom" && !props.browserUrl
        ? { ...record, props: { ...props, browserUrl } }
        : { ...record, props };
    }
    return Object.fromEntries(
      Object.entries(record).map(([key, item]) => [key, visit(item)]),
    );
  };
  return visit(document) as PageDocument;
}

export function serviceSource(
  config: DsuiConfig,
  database: DsuiDatabase,
  id: string,
): ServiceSource | null {
  const configured = config.services.find((service) => service.id === id);
  if (configured) return { service: configured, managedBy: "configuration" };
  const stored = database.getUiService(id);
  return stored ? { service: stored, managedBy: "ui" } : null;
}

/** Resolves and decrypts a service connection. Never logs or returns secrets. */
export function connectionFor(
  cipher: ConnectionCipher | undefined,
  source: ServiceSource,
): Record<string, unknown> {
  if (source.managedBy === "configuration")
    return { ...(source.service as ConfiguredService).connection };
  const row = source.service as UiServiceRow;
  const decrypted = cipher?.decrypt<Record<string, unknown>>({
    ciphertext: row.connection_ciphertext,
    iv: row.connection_iv,
    tag: row.connection_tag,
  });
  if (!decrypted)
    throw new Error("DSUI_MASTER_KEY is required to read UI-managed services");
  return decrypted;
}

/** Shared adapter operations used by both HTTP routes and trusted plugins. */
export async function queryServiceResource(
  deps: Pick<
    ServiceDeps,
    "registry" | "database" | "cipher" | "getConfig" | "refreshConfig"
  >,
  serviceId: string,
  resourceId: string,
  input: unknown,
) {
  await deps.refreshConfig();
  const source = serviceSource(deps.getConfig(), deps.database, serviceId);
  if (!source) throw new Error("Service not found");
  const adapter = deps.registry.get(source.service.adapter);
  return adapter.backend.executeResource(
    resourceId,
    connectionFor(deps.cipher, source),
    input,
    { persistenceNamespace: serviceId },
  );
}

export async function executeServiceAction(
  deps: Pick<
    ServiceDeps,
    | "registry"
    | "database"
    | "cipher"
    | "getConfig"
    | "refreshConfig"
    | "signalBus"
  > & {
    audit(
      actor: string,
      action: string,
      target: string,
      metadata?: Record<string, unknown>,
    ): void;
  },
  serviceId: string,
  actionId: string,
  input: unknown,
  signal: AbortSignal,
  auditActor: string,
  options: { origin?: { pluginId: string; runId?: string } } = {},
) {
  await deps.refreshConfig();
  const source = serviceSource(deps.getConfig(), deps.database, serviceId);
  if (!source) throw new Error("Service not found");
  const adapter = deps.registry.get(source.service.adapter);
  const result = await adapter.backend.executeAction(
    actionId,
    connectionFor(deps.cipher, source),
    input,
    signal,
    { persistenceNamespace: serviceId },
  );
  for (const emission of result.emissions) {
    const declared = adapter.catalog.signals.find(
      (signalDefinition) => signalDefinition.id === emission.signalId,
    );
    if (!declared)
      throw new Error(
        `Adapter action emitted undeclared signal "${emission.signalId}"`,
      );
    deps.signalBus.publish({
      signalId: `${adapter.id}.${emission.signalId}`,
      type: declared.type,
      sourceType: "adapter",
      sourceId: serviceId,
      serviceId,
      payload: emission.payload,
      ...(emission.idempotencyKey
        ? { idempotencyKey: emission.idempotencyKey }
        : {}),
    });
  }
  deps.audit(auditActor, "action.execute", serviceId, {
    action: actionId,
    ...(options.origin?.runId ? { runId: options.origin.runId } : {}),
  });
  return result;
}

export interface ServiceDeps {
  registry: AdapterRegistry;
  pluginRuntime?: PluginRuntime;
  signalBus: SignalBus;
  database: DsuiDatabase;
  cipher: ConnectionCipher | undefined;
  getConfig(): DsuiConfig;
  refreshConfig(): Promise<DsuiConfig>;
  refreshJobs?(): void;
}

export async function publicService(
  deps: ServiceDeps,
  id: string,
  options: { waitForHealth?: boolean } = {},
): Promise<PublicService> {
  const source = serviceSource(deps.getConfig(), deps.database, id);
  if (!source) throw new Error("Service not found");
  let adapter: ReturnType<AdapterRegistry["get"]>;
  try {
    adapter = deps.registry.get(source.service.adapter);
  } catch (error) {
    return {
      id: source.service.id,
      name: source.service.name ?? source.service.adapter,
      adapter: source.service.adapter,
      health: "unavailable",
      detail: error instanceof Error ? error.message : "Adapter unavailable",
      managedBy: source.managedBy,
      resources: [],
      actions: [],
    };
  }
  const connection = connectionFor(deps.cipher, source);
  const health = await serviceHealth(
    deps,
    source.service.id,
    adapter,
    connection,
    options.waitForHealth === true,
  );
  return {
    id: source.service.id,
    name: source.service.name ?? adapter.metadata.name,
    adapter: adapter.id,
    health: health.status,
    ...(health.detail ? { detail: health.detail } : {}),
    ...(health.latencyMs !== undefined ? { latencyMs: health.latencyMs } : {}),
    managedBy: source.managedBy,
    resources: adapter.catalog.resources.map((resource) => resource.id),
    actions: adapter.catalog.actions.map((action) => action.id),
    ...(adapter.metadata.iconUrl ? { logo: adapter.metadata.iconUrl } : {}),
  };
}

export async function testConnection(
  deps: ServiceDeps,
  adapterId: string,
  raw: Record<string, unknown>,
): Promise<HealthStatus> {
  const adapter = deps.registry.get(adapterId);
  const connection = adapter.backend.validateConnection(raw);
  return adapter.backend.checkHealth(connection);
}

export function registerServiceRoutes(
  app: Hono,
  deps: ServiceDeps & {
    audit(
      actor: string,
      action: string,
      target: string,
      metadata?: Record<string, unknown>,
    ): void;
  },
): void {
  app.get("/api/v1/services", async (context) => {
    try {
      const config = await deps.refreshConfig();
      const ids = [
        ...config.services.map((service) => service.id),
        ...deps.database
          .listUiServices()
          .filter(
            (row) => !config.services.some((service) => service.id === row.id),
          )
          .map((row) => row.id),
      ];
      const visible: string[] = [];
      for (const id of ids)
        if (
          !deps.pluginRuntime ||
          (await deps.pluginRuntime.authorize(
            context.get("principal"),
            "inspect",
            { type: "service", id },
          ))
        )
          visible.push(id);
      return context.json(
        await Promise.all(visible.map((id) => publicService(deps, id))),
      );
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.post("/api/v1/services/test", async (context) => {
    if (
      deps.pluginRuntime &&
      !(await deps.pluginRuntime.authorize(context.get("principal"), "inspect"))
    )
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      await deps.refreshConfig();
      const input = createServiceSchema.parse(await context.req.json());
      return context.json(
        await testConnection(deps, input.adapter, input.connection),
      );
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.post("/api/v1/services", async (context) => {
    const principal = context.get("principal");
    if (
      !allowed(principal, "manage") ||
      (deps.pluginRuntime &&
        !(await deps.pluginRuntime.authorize(principal, "manage")))
    )
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      await deps.refreshConfig();
      const input = createServiceSchema.parse(await context.req.json());
      const adapter = deps.registry.get(input.adapter);
      const connection = adapter.backend.validateConnection(input.connection);
      if (!deps.cipher)
        throw new Error(
          "DSUI_MASTER_KEY is required to persist UI-managed connections",
        );
      const id = randomUUID();
      deps.database.insertUiService(
        { id, name: input.name, adapter: input.adapter },
        deps.cipher.encrypt(connection),
      );
      deps.refreshJobs?.();
      deps.audit(principal.id, "service.create", id, {
        adapter: input.adapter,
      });
      return context.json(
        await publicService(deps, id, { waitForHealth: true }),
        201,
      );
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.delete("/api/v1/services/:id", async (context) => {
    const principal = context.get("principal");
    if (
      !allowed(principal, "manage") ||
      (deps.pluginRuntime &&
        !(await deps.pluginRuntime.authorize(principal, "manage", {
          type: "service",
          id: context.req.param("id"),
        })))
    )
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const config = await deps.refreshConfig();
      const source = serviceSource(
        config,
        deps.database,
        context.req.param("id"),
      );
      if (!source) throw new Error("Service not found");
      if (source.managedBy !== "ui")
        throw new Error(
          "Configuration-managed services cannot be deleted here",
        );
      deps.database.deleteUiService(source.service.id);
      healthCache.get(deps)?.delete(source.service.id);
      await deps.registry
        .list()
        .find((adapter) => adapter.id === source.service.adapter)
        ?.backend.invalidateService?.(source.service.id);
      deps.refreshJobs?.();
      deps.audit(principal.id, "service.delete", source.service.id, {
        adapter: source.service.adapter,
      });
      return context.body(null, 204);
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.get("/api/v1/services/:id/pages", async (context) => {
    if (
      deps.pluginRuntime &&
      !(await deps.pluginRuntime.authorize(
        context.get("principal"),
        "inspect",
        { type: "service", id: context.req.param("id") },
      ))
    )
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      await deps.refreshConfig();
      const source = serviceSource(
        deps.getConfig(),
        deps.database,
        context.req.param("id"),
      );
      if (!source) throw new Error("Service not found");
      const adapter = deps.registry.get(source.service.adapter);
      return context.json({ pages: adapter.catalog.pages });
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.get("/api/v1/services/:id/page", async (context) => {
    if (
      deps.pluginRuntime &&
      !(await deps.pluginRuntime.authorize(
        context.get("principal"),
        "inspect",
        { type: "service", id: context.req.param("id") },
      ))
    )
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      await deps.refreshConfig();
      const path = context.req.query("path");
      if (!path?.startsWith("/"))
        return context.json({ message: "A page path is required" }, 400);
      const source = serviceSource(
        deps.getConfig(),
        deps.database,
        context.req.param("id"),
      );
      if (!source) throw new Error("Service not found");
      const adapter = deps.registry.get(source.service.adapter);
      const document = await adapter.backend.renderPage(
        connectionFor(deps.cipher, source),
        path,
        { persistenceNamespace: source.service.id },
      );
      return context.json(
        withBrowserComponents(
          document,
          adapter.browserBundlePath
            ? `/api/v1/adapters/${encodeURIComponent(adapter.id)}/components.mjs`
            : undefined,
        ),
      );
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });
}
