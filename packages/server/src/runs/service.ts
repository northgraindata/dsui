import { readFile } from "node:fs/promises";
import { ProcessRunnerError } from "@northgraindata/dsui-process-runner";
import type { DsuiDatabase } from "../db/database.js";
import {
  type ProviderStatus,
  type Run,
  type RunArtifact,
  type RunArtifactContent,
  type RunEvent,
  type RunEventPage,
  type RunProtocol,
  type StartRunRequest,
  type StartRunResponse,
  startRunRequestFingerprint,
} from "./contracts.js";

export interface RunExecutorRequest {
  readonly invocationId: string;
  readonly request: StartRunRequest;
  readonly signal: AbortSignal;
  readonly onOutput: (event: Extract<RunEvent, { type: "output" }>) => void;
}

export interface RunExecutorResult {
  readonly exitCode: number;
  readonly durationMs?: number;
  readonly providerStatus?: ProviderStatus;
  readonly artifacts?: readonly RunArtifact[];
}

export interface RunExecutor {
  execute(request: RunExecutorRequest): Promise<RunExecutorResult>;
}

function assertRequest(request: StartRunRequest): void {
  if (request.idempotencyKey.trim() === "")
    throw new Error("idempotencyKey must be non-empty");
  if (request.timeoutMs !== undefined && request.timeoutMs <= 0)
    throw new Error("timeoutMs must be positive");
  if ("path" in request.project && "uploadId" in request.project)
    throw new Error("project must contain either path or uploadId");
  if ("path" in request.project) {
    if (
      request.project.path === undefined ||
      request.project.path.trim() === ""
    )
      throw new Error("project path must be non-empty");
  } else if (
    request.project.uploadId === undefined ||
    request.project.uploadId.trim() === ""
  ) {
    throw new Error("project uploadId must be non-empty");
  }
}

function redactOutput(text: string, request: StartRunRequest): string {
  return Object.values(request.environment ?? {}).reduce((result, value) => {
    if (
      !("value" in value) ||
      typeof value.value !== "string" ||
      value.value.length === 0
    )
      return result;
    const secret = value.value;
    return result.split(secret).join("[REDACTED]");
  }, text);
}

function assertLimit(limit: number | undefined): number {
  if (limit === undefined) return 100;
  if (!Number.isSafeInteger(limit) || limit <= 0)
    throw new Error("limit must be a positive integer");
  return limit;
}

export class DurableRunService implements RunProtocol {
  constructor(
    private readonly database: DsuiDatabase,
    private readonly executor: RunExecutor,
  ) {
    // Recovery is deliberately fail-closed: persisted work is visible, but never resumed.
    this.database.recoverInterruptedRuns();
  }

  async startRun(request: StartRunRequest): Promise<StartRunResponse> {
    assertRequest(request);
    const { idempotencyKey: _, ...intent } = request;
    const now = new Date().toISOString();
    const run: Run = {
      invocationId: crypto.randomUUID(),
      request: intent,
      state: "queued",
      createdAt: now,
      cancellable: true,
      retryable: false,
    };
    const claim = this.database.claimStartIdempotency(
      request.idempotencyKey,
      startRunRequestFingerprint(request),
      run,
    );
    if (claim.outcome === "conflict") return claim;
    if (claim.outcome === "existing") {
      return {
        outcome:
          claim.run.state === "queued" ||
          claim.run.state === "running" ||
          claim.run.state === "cancelling"
            ? "in_flight"
            : "replayed",
        run: claim.run,
      };
    }
    void this.execute(run, request);
    return { outcome: "created", run };
  }

  async getRun(request: { readonly invocationId: string }): Promise<Run> {
    return this.requireRun(request.invocationId);
  }

  async listRunEvents(request: {
    readonly invocationId: string;
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<RunEventPage> {
    this.requireRun(request.invocationId);
    return this.database.listRunEvents(
      request.invocationId,
      request.cursor,
      assertLimit(request.limit),
    );
  }

  async cancelRun(request: {
    readonly invocationId: string;
    readonly idempotencyKey: string;
  }): Promise<Run> {
    if (request.idempotencyKey.trim() === "")
      throw new Error("idempotencyKey must be non-empty");
    const run = this.requireRun(request.invocationId);
    if (
      this.database.claimCancellationIdempotency(
        request.invocationId,
        request.idempotencyKey,
      ) === "existing"
    )
      return run;
    if (run.state === "queued" || run.state === "running") {
      const cancelling = {
        ...run,
        state: "cancelling" as const,
        cancellable: true,
      };
      this.database.saveRun(cancelling);
      this.controllers.get(run.invocationId)?.abort();
      return cancelling;
    }
    return run;
  }

  async listRunArtifacts(request: {
    readonly invocationId: string;
  }): Promise<readonly RunArtifact[]> {
    this.requireRun(request.invocationId);
    return this.database.listRunArtifacts(request.invocationId);
  }

  async getRunArtifact(request: {
    readonly invocationId: string;
    readonly artifactId: string;
    readonly maxBytes?: number;
  }): Promise<RunArtifactContent> {
    this.requireRun(request.invocationId);
    const artifact = this.database.getRunArtifact(
      request.invocationId,
      request.artifactId,
    );
    if (!artifact) throw new Error(`Artifact not found: ${request.artifactId}`);
    if (
      request.maxBytes !== undefined &&
      (!Number.isSafeInteger(request.maxBytes) || request.maxBytes <= 0)
    )
      throw new Error("maxBytes must be a positive integer");
    if (artifact.location.kind !== "local")
      return { artifact, truncated: false };
    const content = await readFile(artifact.location.ref, "utf8");
    const maxBytes = request.maxBytes ?? content.length;
    return {
      artifact,
      content: content.slice(0, maxBytes),
      truncated: content.length > maxBytes,
    };
  }

  private readonly controllers = new Map<string, AbortController>();

  private requireRun(invocationId: string): Run {
    const run = this.database.loadRun(invocationId);
    if (!run) throw new Error(`Run not found: ${invocationId}`);
    return run;
  }

  private async execute(run: Run, request: StartRunRequest): Promise<void> {
    const controller = new AbortController();
    this.controllers.set(run.invocationId, controller);
    try {
      if (this.requireRun(run.invocationId).state === "cancelling") {
        this.database.appendRunEvent(run.invocationId, {
          type: "cancelled",
          at: new Date().toISOString(),
        });
        return;
      }
      this.database.appendRunEvent(run.invocationId, {
        type: "started",
        at: new Date().toISOString(),
      });
      const result = await this.executor.execute({
        invocationId: run.invocationId,
        request,
        signal: controller.signal,
        onOutput: (event) =>
          this.database.appendRunEvent(run.invocationId, {
            ...event,
            text: redactOutput(event.text, request),
          }),
      });
      if (this.requireRun(run.invocationId).state === "cancelling") {
        this.database.appendRunEvent(run.invocationId, {
          type: "cancelled",
          at: new Date().toISOString(),
        });
        return;
      }
      for (const artifact of result.artifacts ?? [])
        this.database.appendRunEvent(run.invocationId, {
          type: "artifact_discovered",
          at: new Date().toISOString(),
          artifact,
        });
      const state = result.exitCode === 0 ? "succeeded" : "failed";
      this.database.appendRunEvent(run.invocationId, {
        type: "completed",
        at: new Date().toISOString(),
        state,
        exitCode: result.exitCode,
      });
      const current = this.requireRun(run.invocationId);
      this.database.saveRun({
        ...current,
        completedAt: new Date().toISOString(),
        durationMs: result.durationMs,
        cancellable: false,
        retryable: state === "failed",
        ...(result.providerStatus
          ? { providerStatus: result.providerStatus }
          : {}),
      });
    } catch (error) {
      const code = error instanceof ProcessRunnerError ? error.code : undefined;
      const state =
        code === "CANCELLED"
          ? "cancelled"
          : code === "TIMEOUT"
            ? "timed_out"
            : "failed";
      this.database.appendRunEvent(
        run.invocationId,
        state === "cancelled"
          ? { type: "cancelled", at: new Date().toISOString() }
          : state === "timed_out"
            ? { type: "timed_out", at: new Date().toISOString() }
            : {
                type: "error",
                at: new Date().toISOString(),
                message:
                  error instanceof Error
                    ? error.message
                    : "Run executor failed",
              },
      );
      this.database.saveRun({
        ...this.requireRun(run.invocationId),
        completedAt: new Date().toISOString(),
        cancellable: false,
        retryable: state === "failed",
      });
    } finally {
      this.controllers.delete(run.invocationId);
    }
  }
}
