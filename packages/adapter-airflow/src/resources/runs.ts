import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext, DagTask, TaskInstance } from "../context.js";
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
  query: ({ dagId }, ctx: AirflowContext) => ctx.client.listDagRuns(dagId),
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
  query: ({ dagId, dagRunId }, ctx: AirflowContext) =>
    ctx.client.listTaskInstances(dagId, dagRunId),
  refresh: poll("3s"),
});

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
          state: "awaiting",
        },
      ];
    return taskInstances.map((instance) => ({
      ...instance,
      dagId: instance.dagId || dagId || "",
      dagRunId: instance.dagRunId || dagRunId || "",
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

const tasksCache = new Map<string, { tasks: DagTask[]; expiresAt: number }>();

async function getDagTasksCached(
  dagId: string,
  ctx: AirflowContext,
): Promise<DagTask[]> {
  const cached = tasksCache.get(dagId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tasks;
  }
  const tasks = await ctx.client.listDagTasks(dagId);
  tasksCache.set(dagId, { tasks, expiresAt: Date.now() + 60_000 });
  return tasks;
}

export const taskInstanceGraph = defineResource({
  id: "task-instance-graph",
  input: dagRunInput,
  query: async ({ dagId, dagRunId }, ctx: AirflowContext) => {
    const [tasks, instances] = await Promise.all([
      getDagTasksCached(dagId, ctx),
      ctx.client.listTaskInstances(dagId, dagRunId),
    ]);
    return buildTaskInstanceGraph(tasks, instances, dagId, dagRunId);
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
