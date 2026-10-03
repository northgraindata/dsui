import { defineJob, defineSignal, defineStore, z } from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext, DagRun } from "./context.js";

const dagRunSignalSchema = z.object({
  dagId: z.string(),
  dagRunId: z.string(),
  runType: z.string(),
  logicalDate: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  note: z.string(),
});

export const dagFailed = defineSignal({
  id: "dag-failed",
  type: "error",
  schema: dagRunSignalSchema,
});

export const dagSucceeded = defineSignal({
  id: "dag-succeeded",
  type: "success",
  schema: dagRunSignalSchema,
});

type RunCursor = { completedAt: string; runIds: string[] };

const airflowSignalCursor = defineStore({
  id: "signal-cursor",
  scope: "adapter",
  persistence: { type: "persistent", key: "airflow-signal-cursor", version: 1 },
  state: { cursor: null as RunCursor | null },
  actions: ({ set }) => ({
    advance: (cursor: RunCursor) => set({ cursor }),
  }),
});

function terminalRun(run: DagRun): boolean {
  const state = run.state.toLowerCase();
  const endedAt = Date.parse(run.endDate);
  return (
    (state === "failed" || state === "success") &&
    Number.isFinite(endedAt)
  );
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await map(items[index]!);
      }
    }),
  );
  return results;
}

export const monitorDagRuns = defineJob<AirflowContext>({
  id: "monitor-dag-runs",
  intervalMs: 60_000,
  timeoutMs: 240_000,
  retry: { maxAttempts: 3, backoffMs: 5_000 },
  run: async ({ context, signal, emit, store }) => {
    const cursorStore = store(airflowSignalCursor);
    const storedCursor = cursorStore.get().cursor;
    const firstPoll = !storedCursor;
    const previous: RunCursor = storedCursor ?? {
      completedAt: new Date().toISOString(),
      runIds: [],
    };
    const dags = await context.client.listDags(signal);
    const recentRuns = await mapConcurrent(dags, 8, async (dag) => {
      const runs = await context.client.listDagRuns(dag.dagId, signal);
      return runs.filter(terminalRun);
    });
    if (firstPoll) cursorStore.actions.advance(previous);

    const candidates = recentRuns.flat().sort((a, b) =>
      a.endDate.localeCompare(b.endDate) || a.dagRunId.localeCompare(b.dagRunId),
    );
    const unseen = candidates.filter((run) => {
      const comparison = Date.parse(run.endDate) - Date.parse(previous!.completedAt);
      return comparison > 0 || (comparison === 0 && !previous!.runIds.includes(`${run.dagId}:${run.dagRunId}`));
    });
    for (const run of unseen) {
      const definition =
        run.state.toLowerCase() === "failed" ? dagFailed : dagSucceeded;
      emit(
        definition,
        {
          dagId: run.dagId,
          dagRunId: run.dagRunId,
          runType: run.runType,
          logicalDate: run.logicalDate,
          startDate: run.startDate,
          endDate: run.endDate,
          note: run.note,
        },
        { idempotencyKey: `${run.dagId}:${run.dagRunId}` },
      );
    }
    if (unseen.length) {
      const latest = unseen.reduce(
        (at, run) =>
          Date.parse(run.endDate) > Date.parse(at) ? run.endDate : at,
        previous.completedAt,
      );
      const runIds = candidates
        .filter((run) => Date.parse(run.endDate) === Date.parse(latest))
        .map((run) => `${run.dagId}:${run.dagRunId}`);
      cursorStore.actions.advance({ completedAt: latest, runIds });
    }
  },
});

export const airflowSignals = [dagFailed, dagSucceeded] as const;
export const airflowJobs = [monitorDagRuns] as const;
export const airflowStores = [airflowSignalCursor] as const;
