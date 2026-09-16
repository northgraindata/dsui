/** Durable run protocol shared by the server and future run providers. */

export type NormalizedRunState =
  | "queued"
  | "running"
  | "cancelling"
  | "cancelled"
  | "succeeded"
  | "failed"
  | "timed_out";

export type RunState = NormalizedRunState;

export type TerminalRunState =
  | "cancelled"
  | "succeeded"
  | "failed"
  | "timed_out";

export type RunCommand = "run" | "build" | "test" | "compile" | "docs_generate";

export interface ProviderStatus {
  readonly provider: string;
  /** Provider-native status, retained even when it maps to a normalized state. */
  readonly status: string;
  readonly code?: string;
  readonly message?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type EnvironmentValue =
  | { readonly value: string; readonly secretRef?: never }
  | { readonly secretRef: string; readonly value?: never };

export interface RunRequest {
  readonly command: RunCommand;
  readonly project:
    | { readonly path: string; readonly uploadId?: never }
    | { readonly uploadId: string; readonly path?: never };
  readonly profile?: { readonly name?: string; readonly target?: string };
  /** Raw secret material is not part of a run request; use a host secret ref. */
  readonly environment?: Readonly<Record<string, EnvironmentValue>>;
  readonly args?: Readonly<Record<string, string | boolean | string[]>>;
  readonly cwd?: string;
  readonly timeoutMs?: number;
  /** Stable for one user intent and reused for retries. */
  readonly idempotencyKey: string;
}

export interface Run {
  readonly invocationId: string;
  readonly providerRunId?: string;
  readonly request: Omit<RunRequest, "idempotencyKey">;
  readonly state: RunState;
  readonly providerStatus?: ProviderStatus;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly trigger?: string;
  readonly environment?: string;
  readonly cancellable: boolean;
  readonly retryable: boolean;
  /** Set when this run is an explicit retry of another invocation. */
  readonly retriedFromInvocationId?: string;
}

export type RunEvent =
  | { readonly type: "started"; readonly at: string }
  | {
      readonly type: "output";
      readonly at: string;
      readonly stream: "stdout" | "stderr";
      readonly text: string;
      readonly truncated?: boolean;
    }
  | {
      readonly type: "log";
      readonly at: string;
      readonly message: string;
      readonly level?: "debug" | "info" | "warn" | "error";
    }
  | {
      readonly type: "status";
      readonly at: string;
      readonly state: RunState;
      readonly providerStatus?: ProviderStatus;
    }
  | {
      readonly type: "artifact_discovered";
      readonly at: string;
      readonly artifact: RunArtifact;
    }
  | {
      readonly type: "completed";
      readonly at: string;
      readonly state: TerminalRunState;
      readonly exitCode?: number;
    }
  | { readonly type: "cancelled"; readonly at: string }
  | { readonly type: "timed_out"; readonly at: string }
  | { readonly type: "error"; readonly at: string; readonly message: string };

export interface RunEventPage {
  readonly events: readonly RunEvent[];
  readonly nextCursor?: string;
}

export interface RunArtifact {
  readonly artifactId: string;
  readonly kind: string;
  readonly schemaVersion?: string;
  readonly contentType: string;
  readonly byteSize?: number;
  readonly generatedAt?: string;
  readonly invocationId: string;
  readonly location: {
    readonly kind: "local" | "remote";
    readonly ref: string;
  };
  readonly parseStatus?: "pending" | "parsed" | "unsupported" | "failed";
  readonly warnings?: readonly string[];
  readonly downloadable: boolean;
}

export interface RunArtifactContent {
  readonly artifact: RunArtifact;
  readonly content?: string;
  readonly downloadUrl?: string;
  readonly truncated: boolean;
}

export interface StartRunRequest extends RunRequest {}
export interface GetRunRequest {
  readonly invocationId: string;
}
export interface ListRunEventsRequest {
  readonly invocationId: string;
  readonly cursor?: string;
  readonly limit?: number;
}
export interface CancelRunRequest {
  readonly invocationId: string;
  /** Reusing this key must return the same cancellation result. */
  readonly idempotencyKey: string;
}
export interface ListRunArtifactsRequest {
  readonly invocationId: string;
}
export interface GetRunArtifactRequest {
  readonly invocationId: string;
  readonly artifactId: string;
  readonly maxBytes?: number;
}

export type StartRunResponse =
  | { readonly outcome: "created"; readonly run: Run }
  | { readonly outcome: "replayed"; readonly run: Run }
  | { readonly outcome: "in_flight"; readonly run: Run }
  | { readonly outcome: "conflict"; readonly reason: "idempotency_key_reused" };

export interface RunProtocol {
  startRun(request: StartRunRequest): Promise<StartRunResponse>;
  getRun(request: GetRunRequest): Promise<Run>;
  listRunEvents(request: ListRunEventsRequest): Promise<RunEventPage>;
  cancelRun(request: CancelRunRequest): Promise<Run>;
  listRunArtifacts(
    request: ListRunArtifactsRequest,
  ): Promise<readonly RunArtifact[]>;
  getRunArtifact(request: GetRunArtifactRequest): Promise<RunArtifactContent>;
}

const transitions: Readonly<Record<RunState, readonly RunState[]>> = {
  queued: ["running"],
  running: ["cancelling", "succeeded", "failed", "timed_out"],
  cancelling: ["cancelled"],
  cancelled: [],
  succeeded: [],
  failed: [],
  timed_out: [],
};

export function isValidRunTransition(from: RunState, to: RunState): boolean {
  return from === to || transitions[from].includes(to);
}

export function assertValidRunTransition(from: RunState, to: RunState): void {
  if (!isValidRunTransition(from, to))
    throw new Error(`Invalid run transition: ${from} -> ${to}`);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  return value;
}

/** Deterministic representation for an idempotency store's request hash. */
export function startRunRequestFingerprint(request: RunRequest): string {
  const { idempotencyKey: _, ...intent } = request;
  return JSON.stringify(canonicalize(intent));
}

export interface IdempotencyRecord {
  readonly requestFingerprint: string;
  readonly run: Run;
}

export function resolveStartRetry(
  request: RunRequest,
  existing: IdempotencyRecord | undefined,
): StartRunResponse["outcome"] {
  if (!existing) return "created";
  if (existing.requestFingerprint !== startRunRequestFingerprint(request))
    return "conflict";
  return existing.run.state === "queued" ||
    existing.run.state === "running" ||
    existing.run.state === "cancelling"
    ? "in_flight"
    : "replayed";
}
