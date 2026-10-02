import { defineJob, defineSignal, z } from "@northgraindata/dsui-adapter-sdk";
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

const LOOKBACK_MS = 3 * 60_000;

function recentTerminalRun(run: DagRun, since: number): boolean {
  const state = run.state.toLowerCase();
  const endedAt = Date.parse(run.endDate);
  return (
    (state === "failed" || state === "success") &&
    Number.isFinite(endedAt) &&
    endedAt >= since
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
  run: async ({ context, signal, emit }) => {
    const since = Date.now() - LOOKBACK_MS;
    const dags = await context.client.listDags(signal);
    const recentRuns = await mapConcurrent(dags, 8, async (dag) => {
      const runs = await context.client.listDagRuns(dag.dagId, signal);
      return runs.filter((run) => recentTerminalRun(run, since));
    });

    for (const run of recentRuns.flat()) {
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
  },
});

export const airflowSignals = [dagFailed, dagSucceeded] as const;
export const airflowJobs = [monitorDagRuns] as const;
