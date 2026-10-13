import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type {
  AirflowContext,
  DagDetails,
  DagRun,
  DagTask,
  TaskInstance,
} from "../context.js";
import { dagInput } from "./dags.js";

export const dagRunInput = dagInput.extend({
  dagRunId: z.string().min(1),
});

export const taskInstanceInput = dagRunInput.extend({
  taskId: z.string().min(1),
  mapIndex: z.coerce.number().int().min(-1),
});

export const taskTryInput = taskInstanceInput.extend({
  tryNumber: z.coerce.number().int().nonnegative(),
});

export const dagRuns = defineResource({
  id: "dag-runs",
  input: dagInput,
  query: async ({ dagId }, ctx: AirflowContext) =>
    (await ctx.client.listDagRuns(dagId)).map(formatDagRunForTable),
  refresh: poll("5s"),
});

function runStateTone(state: string) {
  switch (state.toLowerCase()) {
    case "success":
      return "healthy";
    case "failed":
      return "unavailable";
    case "running":
    case "queued":
      return "info";
    default:
      return "muted";
  }
}

export function formatRunDuration(run: Pick<DagRun, "startDate" | "endDate">) {
  const start = Date.parse(run.startDate);
  const end = Date.parse(run.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
    return "—";
  const totalSeconds = Math.round((end - start) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatRunTimestamp(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(" at ", ", ");
}

function formatDagRunForTable(run: DagRun) {
  return {
    ...run,
    logicalDateDisplay: formatRunTimestamp(run.logicalDate),
    startedAt: formatRunTimestamp(run.startDate),
    endedAt: formatRunTimestamp(run.endDate),
  };
}

function displayRunId(run: DagRun) {
  const separator = run.dagRunId.indexOf("__");
  const type = separator > 0 ? run.dagRunId.slice(0, separator) : run.runType;
  return `${type} · ${formatRunTimestamp(run.runAfter || run.logicalDate)}`;
}

export function buildDagOverview(dag: DagDetails, runs: readonly DagRun[]) {
  const states = runs.map((run) => run.state.toLowerCase());
  return {
    ...dag,
    status: dag.isPaused ? "Paused" : "Active",
    statusTone: dag.isPaused ? "warning" : "healthy",
    totalRuns: runs.length,
    successfulRuns: states.filter((state) => state === "success").length,
    failedRuns: states.filter((state) => state === "failed").length,
    runningRuns: states.filter((state) => state === "running").length,
    lastRunDuration: runs[0] ? formatRunDuration(runs[0]) : "—",
  };
}

export const dagOverview = defineResource({
  id: "dag-overview",
  input: dagInput,
  query: async ({ dagId }, ctx: AirflowContext) => {
    const [dag, runs] = await Promise.all([
      ctx.client.getDag(dagId),
      ctx.client.listDagRuns(dagId),
    ]);
    return [buildDagOverview(dag, runs)];
  },
  refresh: poll("5s"),
});

export const recentDagRuns = defineResource({
  id: "recent-dag-runs",
  input: dagInput,
  query: async ({ dagId }, ctx: AirflowContext) =>
    (await ctx.client.listDagRuns(dagId)).slice(0, 5).map((run) => ({
      ...formatDagRunForTable(run),
      displayRunId: displayRunId(run),
      duration: formatRunDuration(run),
      stateTone: runStateTone(run.state),
    })),
  refresh: poll("5s"),
});

export const dagRunDetails = defineResource({
  id: "dag-run-details",
  input: dagRunInput,
  query: ({ dagId, dagRunId }, ctx: AirflowContext) =>
    ctx.client.getDagRun(dagId, dagRunId),
  refresh: poll("3s"),
});

export const taskInstances = defineResource({
  id: "task-instances",
  input: dagRunInput,
  query: async ({ dagId, dagRunId }, ctx: AirflowContext) =>
    (await ctx.client.listTaskInstances(dagId, dagRunId)).map((instance) => ({
      ...instance,
      durationDisplay: formatTaskDuration(instance.duration),
    })),
  refresh: poll("3s"),
});

export function formatTaskDuration(duration: number | null) {
  if (duration === null || !Number.isFinite(duration) || duration < 0)
    return "—";
  return duration.toFixed(2);
}

function graphId(instance: Pick<TaskInstance, "taskId" | "mapIndex">): string {
  return instance.mapIndex < 0
    ? instance.taskId
    : `${instance.taskId}[${instance.mapIndex}]`;
}

function normalizeGraphState(state: string | null | undefined): string {
  if (!state || state === "none") return "awaiting";
  return state;
}

/** Joins static DAG edges to live instances without exposing Airflow to the UI. */
export function buildTaskInstanceGraph(
  tasks: readonly DagTask[],
  instances: readonly TaskInstance[],
  dagId?: string,
  dagRunId?: string,
  runState?: string,
) {
  const byTask = new Map<string, TaskInstance[]>();
  for (const instance of instances) {
    const grouped = byTask.get(instance.taskId) ?? [];
    grouped.push(instance);
    byTask.set(instance.taskId, grouped);
  }
  const dependencyIds = (task: DagTask) =>
    task.upstreamTaskIds.flatMap((taskId) => {
      const upstream = byTask.get(taskId);
      return upstream?.length ? upstream.map(graphId) : [taskId];
    });
  const knownTasks = new Set(tasks.map((task) => task.taskId));
  const missingInstanceState =
    runState === "queued"
      ? "queued"
      : runState === "running"
        ? "scheduled"
        : "awaiting";
  const rows = tasks.flatMap((task) => {
    const taskInstances = byTask.get(task.taskId);
    if (!taskInstances?.length)
      return [
        {
          graphId: task.taskId,
          upstreamGraphIds: dependencyIds(task),
          taskId: task.taskId,
          dagId: dagId ?? "",
          dagRunId: dagRunId ?? "",
          mapIndex: -1,
          tryNumber: 0,
          name: task.name,
          operator: task.operator,
          state: missingInstanceState,
        },
      ];
    return taskInstances.map((instance) => ({
      ...instance,
      dagId: instance.dagId || dagId || "",
      dagRunId: instance.dagRunId || dagRunId || "",
      name:
        instance.mapIndex >= 0
          ? `${instance.name} [${instance.mapIndex}]`
          : instance.name,
      state: normalizeGraphState(instance.state),
      graphId: graphId(instance),
      upstreamGraphIds: dependencyIds(task),
    }));
  });
  return [
    ...rows,
    ...instances
      .filter((instance) => !knownTasks.has(instance.taskId))
      .map((instance) => ({
        ...instance,
        state: normalizeGraphState(instance.state),
        graphId: graphId(instance),
        upstreamGraphIds: [],
      })),
  ];
}

export const taskInstanceGraph = defineResource({
  id: "task-instance-graph",
  input: dagRunInput,
  query: async ({ dagId, dagRunId }, ctx: AirflowContext) => {
    const [tasks, instances, run] = await Promise.all([
      // DAG ids are only unique within one Airflow service. A module-level cache
      // keyed by dagId leaks task definitions between configured services.
      ctx.client.listDagTasks(dagId),
      ctx.client.listTaskInstances(dagId, dagRunId),
      ctx.client.getDagRun(dagId, dagRunId),
    ]);
    return buildTaskInstanceGraph(tasks, instances, dagId, dagRunId, run.state);
  },
  refresh: poll("2s"),
});

export const latestDagTaskGraph = defineResource({
  id: "latest-dag-task-graph",
  input: dagInput,
  query: async ({ dagId }, ctx: AirflowContext) => {
    const [tasks, runs] = await Promise.all([
      ctx.client.listDagTasks(dagId),
      ctx.client.listDagRuns(dagId),
    ]);
    const latestRun = runs[0];
    if (!latestRun) return buildTaskInstanceGraph(tasks, []);
    const instances = await ctx.client.listTaskInstances(
      dagId,
      latestRun.dagRunId,
    );
    return buildTaskInstanceGraph(
      tasks,
      instances,
      dagId,
      latestRun.dagRunId,
      latestRun.state,
    );
  },
  refresh: poll("2s"),
});

export const taskInstanceDetails = defineResource({
  id: "task-instance-details",
  input: taskInstanceInput,
  query: (input, ctx: AirflowContext) => ctx.client.getTaskInstance(input),
  refresh: poll("3s"),
});

export const taskLog = defineResource({
  id: "task-log",
  input: taskTryInput,
  query: (input, ctx: AirflowContext) => ctx.client.getTaskLog(input),
  refresh: poll("10s"),
});

const MAX_DAG_RUN_LOG_TASKS = 30;
const MAX_DAG_RUN_LOG_CHARACTERS = 100_000;

function formatTaskLog(
  entries: readonly { timestamp: string; event: string }[],
) {
  return entries
    .map((entry) =>
      entry.timestamp ? `[${entry.timestamp}] ${entry.event}` : entry.event,
    )
    .join("\n")
    .slice(0, MAX_DAG_RUN_LOG_CHARACTERS);
}

export const dagRunLogs = defineResource({
  id: "dag-run-logs",
  input: dagRunInput,
  query: async ({ dagId, dagRunId }, ctx: AirflowContext) => {
    const instances = await ctx.client.listTaskInstances(dagId, dagRunId);
    const tasks = instances
      .filter((instance) => instance.tryNumber > 0)
      .slice(0, MAX_DAG_RUN_LOG_TASKS);
    const logs = await Promise.all(
      tasks.map(async (instance) => {
        try {
          const entries = await ctx.client.getTaskLog({
            dagId,
            dagRunId,
            taskId: instance.taskId,
            mapIndex: instance.mapIndex,
            tryNumber: instance.tryNumber,
          });
          return {
            label: `${instance.name} · try ${instance.tryNumber}`,
            content: formatTaskLog(entries) || "No log output.",
          };
        } catch (cause) {
          return {
            label: `${instance.name} · try ${instance.tryNumber}`,
            content: `Could not load this task log: ${cause instanceof Error ? cause.message : "Unknown error"}`,
          };
        }
      }),
    );
    if (instances.length > tasks.length)
      logs.push({
        label: "More task logs available",
        content: `Showing the latest attempts for the first ${MAX_DAG_RUN_LOG_TASKS} tasks. Open an individual task to inspect other logs.`,
      });
    return logs;
  },
});
