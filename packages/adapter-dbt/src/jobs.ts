import {
  defineJob,
  defineSignal,
  defineStore,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import { readArtifact } from "./artifacts.js";
import type { DbtCloudRun } from "./client.js";
import type { DbtContext } from "./context.js";

type RunCursor = { finishedAt: string; runIds: string[] };

const dbtSignalCursor = defineStore({
  id: "signal-cursor",
  scope: "adapter",
  persistence: { type: "persistent", key: "dbt-signal-cursor", version: 1 },
  state: { cursor: null as RunCursor | null },
  actions: ({ set }) => ({
    advance: (cursor: RunCursor) => set({ cursor }),
  }),
});

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
  run: async ({ context, signal, emit, store }) => {
    const cursorStore = store(dbtSignalCursor);
    const storedCursor = cursorStore.get().cursor;
    const firstPoll = !storedCursor;
    const previous: RunCursor = storedCursor ?? {
      finishedAt: new Date().toISOString(),
      runIds: [],
    };
    if (context.cloud) {
      const runs = await context.cloud.listRuns(signal, 100);
      const candidates = runs
        .filter((run) => cloudRunType(run.status ?? "") && Number.isFinite(Date.parse(run.finished_at ?? "")))
        .sort((a, b) => (a.finished_at ?? "").localeCompare(b.finished_at ?? "") || a.id.localeCompare(b.id));
      if (firstPoll) cursorStore.actions.advance(previous);
      const unseen = candidates.filter((run) => {
        const comparison = Date.parse(run.finished_at!) - Date.parse(previous!.finishedAt);
        return comparison > 0 || (comparison === 0 && !previous!.runIds.includes(run.id));
      });
      for (const run of unseen) {
        const definition = cloudRunType(run.status ?? "");
        if (!definition) continue;
        emit(definition, cloudPayload(run), { idempotencyKey: run.id });
      }
      advanceCursor(cursorStore, candidates, unseen, previous);
      return;
    }

    if (context.config.method !== "local") return;
    const artifact = await readArtifact(context.config, "run_results.json");
    if (!artifact.data) return;
    if (firstPoll) cursorStore.actions.advance(previous);
    const result = localRunResults(artifact.data);
    if (
      !result.runId ||
      !Array.isArray(artifact.data.results) ||
      artifact.data.results.length === 0
    )
      return;
    if (Date.parse(result.generatedAt) < Date.parse(previous.finishedAt)) return;
    if (previous.runIds.includes(result.runId)) return;
    const definition = result.failedNodes.length
      ? dbtRunFailed
      : result.warningNodes.length
        ? dbtRunWarning
        : dbtRunSucceeded;
    emit(definition, result, { idempotencyKey: result.runId });
    cursorStore.actions.advance({
      finishedAt: result.generatedAt,
      runIds: [result.runId],
    });
  },
});

function advanceCursor<T extends { id: string | number; finished_at?: string | null }>(
  store: { actions: { advance: (cursor: RunCursor) => void } },
  candidates: readonly T[],
  unseen: readonly T[],
  previous: RunCursor,
): void {
  if (!unseen.length) return;
  const latest = unseen.reduce(
    (at, run) => (Date.parse(run.finished_at ?? "") > Date.parse(at) ? run.finished_at! : at),
    previous.finishedAt,
  );
  const runIds = candidates
    .filter((run) => Date.parse(run.finished_at ?? "") === Date.parse(latest))
    .map((run) => String(run.id));
  store.actions.advance({ finishedAt: latest, runIds });
}

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
export const dbtStores = [dbtSignalCursor] as const;
