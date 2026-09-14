import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext, DagTask } from "../context.js";

export const dagInput = z.object({ dagId: z.string().min(1) });

export const dags = defineResource({
  id: "dags",
  query: async (_, ctx: AirflowContext) =>
    (await ctx.client.listDags()).map((dag) => ({
      ...dag,
      status: dag.isPaused ? "paused" : "active",
      statusTone: dag.isPaused ? "warning" : "healthy",
    })),
  refresh: poll("5s"),
});

export const dagDetails = defineResource({
  id: "dag-details",
  input: dagInput,
  query: ({ dagId }, ctx: AirflowContext) => ctx.client.getDag(dagId),
  refresh: poll("5s"),
});

export const dagSource = defineResource({
  id: "dag-source",
  input: dagInput,
  query: async ({ dagId }, ctx: AirflowContext) => [
    { content: await ctx.client.getDagSource(dagId) },
  ],
});

export const dagTasks = defineResource({
  id: "dag-tasks",
  input: dagInput,
  query: ({ dagId }, ctx: AirflowContext) => ctx.client.listDagTasks(dagId),
});

function structureItem(task: DagTask, role: "Start" | "Task" | "Endpoint") {
  return {
    ...task,
    role,
    displayName: role === "Endpoint" ? task.name : `${task.name} →`,
    icon: role === "Endpoint" ? "check" : role === "Start" ? "play" : "network",
  };
}

export function buildDagStructurePreview(
  tasks: readonly DagTask[],
  maximumItems = 5,
) {
  if (tasks.length <= maximumItems)
    return tasks.map((task, index) =>
      structureItem(
        task,
        task.downstreamTaskIds.length === 0
          ? "Endpoint"
          : index === 0
            ? "Start"
            : "Task",
      ),
    );
  const endpoint =
    [...tasks].reverse().find((task) => task.downstreamTaskIds.length === 0) ??
    tasks[tasks.length - 1];
  if (!endpoint) return [];
  const leading = tasks
    .filter((task) => task.taskId !== endpoint.taskId)
    .slice(0, Math.max(1, maximumItems - 2));
  const hiddenCount = tasks.length - leading.length - 1;
  return [
    ...leading.map((task, index) =>
      structureItem(task, index === 0 ? "Start" : "Task"),
    ),
    {
      taskId: "__ellipsis__",
      name: "…",
      displayName: "… →",
      operator: `${hiddenCount} more tasks`,
      owner: "",
      isMapped: false,
      upstreamTaskIds: [],
      downstreamTaskIds: [],
      role: "Hidden",
      icon: "more",
    },
    structureItem(endpoint, "Endpoint"),
  ];
}

export const dagStructurePreview = defineResource({
  id: "dag-structure-preview",
  input: dagInput,
  query: async ({ dagId }, ctx: AirflowContext) =>
    buildDagStructurePreview(await ctx.client.listDagTasks(dagId)),
  refresh: poll("10s"),
});
