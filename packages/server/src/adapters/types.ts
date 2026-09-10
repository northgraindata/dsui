import type {
  AdapterDefinition,
  AdapterInfo,
} from "@northgraindata/dsui-adapter-sdk";
import type { HealthStatus, PageDocument } from "@northgraindata/dsui-core";

/**
 * Where an adapter comes from. Every adapter — the default Snowflake
 * build included — resolves through the same loader; nothing in the
 * server names an adapter package directly.
 */
export type AdapterPackageSource = {
  /** Bare package name (`@acme/dsui-adapter-x`) or absolute bundle path. */
  package: string;
  /** Exact SemVer version. Absent = resolve locally, run in-process. */
  version?: string;
  /** SHA-512 tarball SRI. Required with `version`. */
  integrity?: string;
  /** Bundle entry override, e.g. `./dist/adapter.mjs`. */
  entry?: string;
};

/** JSON Schema (draft 2020-12-ish) for a Zod input or connection schema. */
export type JsonSchema = Record<string, unknown>;

export interface LoadedConnectionMethod {
  id: string;
  label: string;
  description?: string;
  schema: JsonSchema;
  group?: {
    id: string;
    label: string;
    description?: string;
  };
}

export interface ResourceCatalogEntry {
  id: string;
  inputSchema?: JsonSchema;
  refresh?: { kind: string; intervalMs?: number };
}
export interface ActionCatalogEntry {
  id: string;
  inputSchema?: JsonSchema;
}
export interface PageCatalogEntry {
  path: string;
}
export interface AdapterCatalog {
  resources: ResourceCatalogEntry[];
  actions: ActionCatalogEntry[];
  pages: PageCatalogEntry[];
}

export interface AdapterHealth extends HealthStatus {}

/**
 * Execution backend behind a loaded adapter. Local adapters run the SDK
 * in-process; verified community adapters run in an `adapter-host`
 * subprocess. Both sides honor this contract, so services never branch
 * on adapter origin.
 */
export interface AdapterBackend {
  closeSession?(id: string): Promise<void>;
  dispose?(): Promise<void>;
  /** Validate a connection object; returns the parsed value. */
  validateConnection(connection: unknown): unknown;
  /** Probe: instantiate (and dispose) against a connection. */
  checkHealth(connection: unknown): Promise<HealthStatus>;
  /** Renders and validates an adapter page for a concrete path. */
  renderPage(
    connection: unknown,
    path: string,
    sessionId?: string,
  ): Promise<PageDocument>;
  /** Execute one resource query; throws AdapterExecutionError on failure. */
  executeResource(
    resourceId: string,
    connection: unknown,
    input: unknown,
    sessionId?: string,
  ): Promise<{ data: unknown }>;
  /** Execute one action; cancellable in-process, timeout-bound remotely. */
  executeAction(
    actionId: string,
    connection: unknown,
    input: unknown,
    signal?: AbortSignal,
    sessionId?: string,
  ): Promise<
    { status: "success"; data: unknown } | { status: "error"; message: string }
  >;
}

/** Load outcome per adapter id, served alongside the adapter list. */
export interface AdapterReadiness {
  status: "ok" | "unavailable";
  detail?: string;
}

/**
 * A loaded adapter ready to serve: resolved metadata and catalog plus
 * an execution backend. The registry key (logical id) always equals
 * `metadata.id`.
 */
export interface LoadedAdapter {
  readonly id: string;
  readonly metadata: AdapterInfo;
  /** JSON Schema for the connection object; absent when unavailable. */
  readonly connectionSchema?: JsonSchema;
  /** Named connection methods; absent for adapters that declare none. */
  readonly connectionMethods?: LoadedConnectionMethod[];
  readonly catalog: AdapterCatalog;
  readonly backend: AdapterBackend;
  /** The live definition. Present for in-process adapters only. */
  readonly definition?: AdapterDefinition;
}

export class AdapterLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterLoadError";
  }
}

export class AdapterExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterExecutionError";
  }
}
