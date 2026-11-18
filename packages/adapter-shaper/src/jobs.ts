import {
  defineJob,
  defineSignal,
  defineStore,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { ShaperApp, ShaperContext } from "./context.js";

const taskRunSchema = z.object({
  taskId: z.string(),
  name: z.string(),
  path: z.string(),
  ranAt: z.string(),
  /** Milliseconds, or 0 when Shaper did not report a duration. */
  durationMs: z.number(),
});

export const taskFailed = defineSignal({
  id: "task-failed",
  type: "error",
  schema: taskRunSchema,
});

export const taskSucceeded = defineSignal({
  id: "task-succeeded",
  type: "success",
  schema: taskRunSchema,
});

/**
 * The last run time already reported for each task.
 *
 * Shaper keeps only the latest run per task and has no event feed, so a
 * changed `lastRunAt` is the only evidence a task ran again.
 */
const taskRunCursor = defineStore({
  id: "task-run-cursor",
  scope: "adapter",
  persistence: { type: "persistent", key: "shaper-task-runs", version: 1 },
  state: { seen: null as Record<string, string> | null },
  actions: ({ set }) => ({
    replace: (seen: Record<string, string>) => set({ seen }),
  }),
});

/** Tasks whose latest run is newer than the one already reported. */
export function newTaskRuns(
  tasks: readonly ShaperApp[],
  seen: Readonly<Record<string, string>>,
) {
  return tasks.flatMap((task) => {
    const ranAt = task.taskInfo?.lastRunAt;
    if (ranAt === undefined || seen[task.id] === ranAt) return [];
    return [{ task, ranAt }];
  });
}

export const monitorTasks = defineJob<ShaperContext>({
  id: "monitor-tasks",
  intervalMs: 60_000,
  timeoutMs: 45_000,
  retry: { maxAttempts: 3, backoffMs: 5_000 },
  run: async ({ context, signal, emit, store }) => {
    const cursor = store(taskRunCursor);
    const stored = cursor.get().seen;
    const tasks = (await context.client.listApps(signal)).filter(
      (app) => app.type === "task",
    );
    const current: Record<string, string> = {};
    for (const task of tasks) {
      if (task.taskInfo?.lastRunAt) current[task.id] = task.taskInfo.lastRunAt;
    }
    // The first poll only records history, so enabling the adapter does not
    // announce every task that ran before it was connected.
    if (stored !== null) {
      for (const { task, ranAt } of newTaskRuns(tasks, stored)) {
        emit(
          task.taskInfo?.lastRunSuccess ? taskSucceeded : taskFailed,
          {
            taskId: task.id,
            name: task.name,
            path: task.path,
            ranAt,
            durationMs: task.taskInfo?.lastRunDuration ?? 0,
          },
          { idempotencyKey: `${task.id}:${ranAt}` },
        );
      }
    }
    cursor.actions.replace(current);
  },
});

export const shaperSignals = [taskFailed, taskSucceeded] as const;
export const shaperJobs = [monitorTasks] as const;
export const shaperStores = [taskRunCursor] as const;
