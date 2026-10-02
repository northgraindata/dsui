import {
  defineJob,
  defineSignal,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import { readArtifact } from "./artifacts.js";
import type { DbtCloudRun } from "./client.js";
import type { DbtContext } from "./context.js";

const LOOKBACK_MS = 5 * 60_000;

const cloudRunSchema = z.object({
  runId: z.string(),
  jobId: z.string(),
  status: z.string(),
  cause: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
});

const localRunSchema = z.object({
  runId: z.string(),
  generatedAt: z.string(),
  failedNodes: z.array(z.string()),
  warningNodes: z.array(z.string()),
});

export const dbtRunFailed = defineSignal({
  id: "run-failed",
  type: "error",
  schema: z.union([cloudRunSchema, localRunSchema]),
});

export const dbtRunWarning = defineSignal({
  id: "run-warning",
  type: "warning",
  schema: z.union([cloudRunSchema, localRunSchema]),
});

export const dbtRunSucceeded = defineSignal({
  id: "run-succeeded",
  type: "success",
  schema: z.union([cloudRunSchema, localRunSchema]),
});

function cloudRunType(
  status: string,
):
  | typeof dbtRunFailed
  | typeof dbtRunWarning
  | typeof dbtRunSucceeded
  | undefined {
  switch (status.toLowerCase()) {
    case "error":
    case "failed":
    case "fail":
      return dbtRunFailed;
    case "success":
    case "passed":
    case "pass":
      return dbtRunSucceeded;
    case "cancelled":
    case "canceled":
      return dbtRunWarning;
    default:
      return undefined;
  }
}

function cloudPayload(run: DbtCloudRun) {
  return {
    runId: run.id,
    jobId: run.job_id,
    status: run.status ?? "unknown",
    cause: run.cause ?? "",
    startedAt: run.started_at ?? "",
    finishedAt: run.finished_at ?? "",
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function localRunResults(data: Record<string, unknown>) {
  const metadata = record(data.metadata);
  const generatedAt =
    typeof metadata?.generated_at === "string" ? metadata.generated_at : "";
  const runId =
    typeof metadata?.invocation_id === "string"
      ? metadata.invocation_id
      : generatedAt;
  const results = Array.isArray(data.results) ? data.results : [];
  const failedNodes: string[] = [];
  const warningNodes: string[] = [];
  for (const value of results) {
    const item = record(value);
    if (!item || typeof item.status !== "string") continue;
    const uniqueId =
      typeof item.unique_id === "string" ? item.unique_id : undefined;
    if (!uniqueId) continue;
    if (["error", "fail", "failed"].includes(item.status.toLowerCase()))
      failedNodes.push(uniqueId);
    else if (["warn", "warning"].includes(item.status.toLowerCase()))
      warningNodes.push(uniqueId);
  }
  return { runId, generatedAt, failedNodes, warningNodes };
}

export const monitorDbtRuns = defineJob<DbtContext>({
  id: "monitor-runs",
  intervalMs: 60_000,
  timeoutMs: 180_000,
  retry: { maxAttempts: 3, backoffMs: 5_000 },
  run: async ({ context, signal, emit }) => {
    const since = Date.now() - LOOKBACK_MS;
    if (context.cloud) {
      const runs = await context.cloud.listRuns(signal, 100);
      for (const run of runs) {
        const definition = cloudRunType(run.status ?? "");
        if (!definition || !isRecent(run.finished_at, since)) continue;
        emit(definition, cloudPayload(run), { idempotencyKey: run.id });
      }
      return;
    }

    if (context.config.method !== "local") return;
    const artifact = await readArtifact(context.config, "run_results.json");
    if (!artifact.data) return;
    const result = localRunResults(artifact.data);
    if (
      !result.runId ||
      !isRecent(result.generatedAt, since) ||
      !Array.isArray(artifact.data.results) ||
      artifact.data.results.length === 0
    )
      return;
    const definition = result.failedNodes.length
      ? dbtRunFailed
      : result.warningNodes.length
        ? dbtRunWarning
        : dbtRunSucceeded;
    emit(definition, result, { idempotencyKey: result.runId });
  },
});

function isRecent(value: string | undefined, since: number): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= since;
}

export const dbtSignals = [
  dbtRunFailed,
  dbtRunWarning,
  dbtRunSucceeded,
] as const;
export const dbtJobs = [monitorDbtRuns] as const;
