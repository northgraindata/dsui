import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  type ActionBinding,
  ADAPTER_SDK_VERSION,
  type AdapterDefinition,
  type AdapterInfo,
  createAdapterInstance,
  type ResourceBinding,
} from "@northgraindata/dsui-adapter-sdk";
import type { HealthStatus } from "@northgraindata/dsui-core";
import zodToJsonSchema from "zod-to-json-schema";
import { AdapterHostClient } from "./host.js";
import { type AdapterFetch, ExternalAdapterManager } from "./installer.js";
import type {
  AdapterBackend,
  AdapterCatalog,
  AdapterPackageSource,
  JsonSchema,
  LoadedAdapter,
} from "./types.js";
import { AdapterExecutionError, AdapterLoadError } from "./types.js";

export interface AdapterLoadOptions {
  dataDir?: string;
  fetch?: AdapterFetch;
  offline?: boolean;
  /** Subprocess host factory; tests inject fakes. */
  spawnHost?: (bundlePath: string) => {
    request(request: {
      method: "describe" | "health" | "resource" | "action";
      connection?: unknown;
      target?: string;
      input?: unknown;
    }): Promise<unknown>;
  };
  /** Host call budget in ms (actions run long). */
  hostTimeoutMs?: number;
}

type CallableResource = (
  input: unknown,
) => ResourceBinding<unknown, unknown, unknown>;
type CallableAction = (
  input: unknown,
) => ActionBinding<unknown, unknown, unknown>;

/** Structural gate: every loaded module must satisfy the SDK contract. */
export function assertAdapterDefinition(
  value: unknown,
  from: string,
): AdapterDefinition {
  const problem = (detail: string) =>
    new AdapterLoadError(`Invalid adapter definition from ${from}: ${detail}`);
  if (!value || typeof value !== "object") throw problem("not an object");
  const candidate = value as Record<string, unknown>;
  if (candidate.kind !== "adapter") throw problem("missing kind");
  const metadata = candidate.metadata as Record<string, unknown>;
  if (!metadata || typeof metadata.id !== "string" || !metadata.id)
    throw problem("metadata.id must be a non-empty string");
  if (candidate.sdkVersion !== ADAPTER_SDK_VERSION)
    throw problem(
      `targets SDK ${String(candidate.sdkVersion)}; host requires ${ADAPTER_SDK_VERSION}`,
    );
  if (typeof candidate.createContext !== "function")
    throw problem("missing createContext factory");
  for (const key of ["stores", "resources", "actions", "pages"] as const) {
    if (!Array.isArray(candidate[key])) throw problem(`missing ${key} list`);
  }
  return value as AdapterDefinition;
}

function toJsonSchema(schema: unknown): JsonSchema | undefined {
  if (!schema || typeof schema !== "object") return undefined;
  try {
    return zodToJsonSchema(
      schema as Parameters<typeof zodToJsonSchema>[0],
    ) as JsonSchema;
  } catch {
    return undefined;
  }
}

function findMember<T extends { id: string }>(
  list: readonly T[],
  kind: string,
  id: string,
): T {
  const member = list.find((item) => item.id === id);
  if (!member) throw new AdapterExecutionError(`Unknown ${kind}: ${id}`);
  return member;
}

/** Catalog derived from a live definition (same zod copy: strict). */
export function catalogFromDefinition<TContext, TConfig>(
  definition: AdapterDefinition<TContext, TConfig>,
): AdapterCatalog {
  return {
    resources: definition.resources.map((resource) => ({
      id: resource.id,
      // Runtime members are callables carrying the full definition.
      inputSchema: toJsonSchema(
        (resource as { definition?: { inputSchema?: unknown } }).definition
          ?.inputSchema,
      ),
      refresh:
        resource.refresh.kind === "poll"
          ? { kind: "poll", intervalMs: resource.refresh.intervalMs }
          : { kind: "manual" },
    })),
    actions: definition.actions.map((action) => ({
      id: action.id,
      inputSchema: toJsonSchema(
        (action as { definition?: { inputSchema?: unknown } }).definition
          ?.inputSchema,
      ),
    })),
    pages: definition.pages.map((page) => ({ path: page.path })),
  };
}

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
  };
}

class LocalBackend implements AdapterBackend {
  constructor(private readonly definition: AdapterDefinition) {}

  validateConnection(connection: unknown): unknown {
    return this.definition.connectionSchema?.parse(connection) ?? connection;
  }

  async checkHealth(connection: unknown): Promise<HealthStatus> {
    const started = Date.now();
    try {
      const instance = await createAdapterInstance(this.definition, connection);
      try {
        return healthy(started);
      } finally {
        await instance.dispose();
      }
    } catch (error) {
      return unhealthy(started, error);
    }
  }

  async executeResource(
    resourceId: string,
    connection: unknown,
    input: unknown,
  ): Promise<{ data: unknown }> {
    const resource = findMember(
      this.definition.resources,
      "resource",
      resourceId,
    );
    const instance = await createAdapterInstance(this.definition, connection);
    try {
      const binding = (resource as unknown as CallableResource)(input);
      const result = await instance.executeResource(binding);
      if (result.status === "error") throw result.error;
      return { data: result.data };
    } catch (error) {
      if (error instanceof AdapterExecutionError) throw error;
      throw new AdapterExecutionError(
        error instanceof Error ? error.message : "Resource execution failed",
      );
    } finally {
      await instance.dispose();
    }
  }

  async executeAction(
    actionId: string,
    connection: unknown,
    input: unknown,
    signal?: AbortSignal,
  ): Promise<
    { status: "success"; data: unknown } | { status: "error"; message: string }
  > {
    const action = findMember(this.definition.actions, "action", actionId);
    const instance = await createAdapterInstance(this.definition, connection);
    try {
      const binding = (action as unknown as CallableAction)(input);
      const result = await instance.executeAction(binding, { signal });
      if (result.status === "error")
        return { status: "error", message: result.error.message };
      return { status: "success", data: result.data };
    } finally {
      await instance.dispose();
    }
  }
}

function assertCatalog(value: unknown, from: string): AdapterCatalog {
  if (!value || typeof value !== "object")
    throw new AdapterLoadError(`Invalid adapter catalog from ${from}`);
  const catalog = value as Record<string, unknown>;
  for (const key of ["resources", "actions", "pages"] as const) {
    if (!Array.isArray(catalog[key]))
      throw new AdapterLoadError(`Invalid adapter catalog from ${from}`);
  }
  return value as AdapterCatalog;
}

function assertHealthStatus(value: unknown, from: string): HealthStatus {
  if (!value || typeof value !== "object")
    throw new AdapterLoadError(`Invalid health status from ${from}`);
  return value as HealthStatus;
}

class RemoteBackend implements AdapterBackend {
  constructor(
    private readonly host: {
      request(request: {
        method: "describe" | "health" | "resource" | "action";
        connection?: unknown;
        target?: string;
        input?: unknown;
      }): Promise<unknown>;
    },
  ) {}

  validateConnection(connection: unknown): unknown {
    // Remote schemas live in the bundle; the host validates per call.
    return connection;
  }

  async checkHealth(connection: unknown): Promise<HealthStatus> {
    const started = Date.now();
    try {
      const status = assertHealthStatus(
        await this.host.request({ method: "health", connection }),
        "adapter host",
      );
      return { ...status, latencyMs: status.latencyMs ?? Date.now() - started };
    } catch (error) {
      return unhealthy(started, error);
    }
  }

  async executeResource(
    resourceId: string,
    connection: unknown,
    input: unknown,
  ): Promise<{ data: unknown }> {
    try {
      const result = (await this.host.request({
        method: "resource",
        connection,
        target: resourceId,
        input,
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
  ): Promise<
    { status: "success"; data: unknown } | { status: "error"; message: string }
  > {
    const result = (await this.host.request({
      method: "action",
      connection,
      target: actionId,
      input,
    })) as
      | { status: "success"; data: unknown }
      | { status: "error"; message: string };
    if (!result || typeof result !== "object" || !("status" in result))
      throw new AdapterExecutionError("Adapter host returned no result");
    return result;
  }
}

/**
 * Command that runs one adapter-host subprocess for a verified bundle.
 * Source checkouts execute adapter-host.ts directly; the compiled binary
 * re-enters itself in adapter-host mode. Never inferred from argv, which
 * cannot distinguish `bun run` from `bun test`.
 */
export function defaultHostCommand(bundlePath: string): {
  command: string;
  args: string[];
} {
  try {
    const hostPath = fileURLToPath(
      new URL("../adapter-host.ts", import.meta.url),
    );
    if (existsSync(hostPath))
      return {
        command: process.execPath,
        args: [hostPath, "adapter-host", "--bundle", bundlePath],
      };
  } catch {
    // Compiled binary: adapter-host.ts is not on disk; re-enter below.
  }
  return {
    command: process.execPath,
    args: ["adapter-host", "--bundle", bundlePath],
  };
}

async function importModule(specifier: string): Promise<unknown> {
  const target =
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/") ||
    specifier.startsWith("file:")
      ? pathToFileURL(specifier).href
      : specifier;
  return import(target);
}

function asDefinitionModule(module: unknown, from: string): AdapterDefinition {
  const definition =
    (module as { default?: unknown })?.default ??
    (module as { adapter?: unknown })?.adapter;
  return assertAdapterDefinition(definition, from);
}

/**
 * Loads one adapter by logical id. Local packages (no version) import
 * in-process; pinned npm sources install verified and run isolated.
 * Either way the result satisfies the same contract.
 */
export async function loadAdapter(
  id: string,
  source: AdapterPackageSource,
  options: AdapterLoadOptions = {},
): Promise<LoadedAdapter> {
  if (!source.version) {
    const definition = asDefinitionModule(
      await importModule(source.package).catch((error: unknown) => {
        throw new AdapterLoadError(
          `Cannot load adapter package "${source.package}": ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }),
      source.package,
    );
    if (definition.metadata.id !== id)
      throw new AdapterLoadError(
        `Adapter package declares id "${definition.metadata.id}" but is registered as "${id}"`,
      );
    return {
      id,
      metadata: { ...definition.metadata },
      connectionSchema: toJsonSchema(definition.connectionSchema),
      catalog: catalogFromDefinition(definition),
      backend: new LocalBackend(definition),
      definition,
    };
  }
  if (!source.integrity)
    throw new AdapterLoadError(
      `Pinned adapter "${source.package}" requires an integrity digest`,
    );
  const manager = new ExternalAdapterManager({
    dataDir: options.dataDir,
    fetch: options.fetch,
    offline: options.offline,
  });
  const installed = await manager
    .installedFor({
      source: "npm",
      package: source.package,
      version: source.version,
      integrity: source.integrity,
      ...(source.entry ? { entry: source.entry } : {}),
    })
    .catch((error: unknown) => {
      throw new AdapterLoadError(
        `Cannot resolve adapter "${source.package}": ${error instanceof Error ? error.message : "unknown error"}`,
      );
    });
  const found =
    installed ??
    (await manager
      .install({
        source: "npm",
        package: source.package,
        version: source.version,
        integrity: source.integrity,
        ...(source.entry ? { entry: source.entry } : {}),
      })
      .catch((error: unknown) => {
        throw new AdapterLoadError(
          `Cannot install adapter "${source.package}": ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }));
  const spawn =
    options.spawnHost ??
    ((bundlePath: string) => {
      const { command, args } = defaultHostCommand(bundlePath);
      return new AdapterHostClient({
        command,
        args,
        timeoutMs: options.hostTimeoutMs ?? 600_000,
      });
    });
  const host = spawn(found.bundlePath);
  const catalog = assertCatalog(
    await host.request({ method: "describe" }).catch((error: unknown) => {
      throw new AdapterLoadError(
        `Adapter host describe failed for "${id}": ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }),
    found.bundlePath,
  );
  const metadata = (catalog as { metadata?: AdapterInfo }).metadata;
  if (!metadata || metadata.id !== id)
    throw new AdapterLoadError(
      `Adapter bundle declares id "${metadata?.id ?? "?"}" but is registered as "${id}"`,
    );
  return {
    id,
    metadata: { ...metadata },
    catalog: {
      resources: catalog.resources,
      actions: catalog.actions,
      pages: catalog.pages,
    },
    backend: new RemoteBackend(host),
  };
}
