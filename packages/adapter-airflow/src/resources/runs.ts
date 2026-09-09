import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext } from "../context.js";
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
  refresh: poll("10s"),
});

export const dagRunDetails = defineResource({
  id: "dag-run-details",
  input: dagRunInput,
  query: ({ dagId, dagRunId }, ctx: AirflowContext) =>
    ctx.client.getDagRun(dagId, dagRunId),
  refresh: poll("10s"),
});

export const taskInstances = defineResource({
  id: "task-instances",
  input: dagRunInput,
  query: ({ dagId, dagRunId }, ctx: AirflowContext) =>
    ctx.client.listTaskInstances(dagId, dagRunId),
  refresh: poll("10s"),
});

export const taskInstanceDetails = defineResource({
  id: "task-instance-details",
  input: taskInstanceInput,
  query: (input, ctx: AirflowContext) => ctx.client.getTaskInstance(input),
  refresh: poll("10s"),
});

export const taskLog = defineResource({
  id: "task-log",
  input: taskTryInput,
  query: (input, ctx: AirflowContext) => ctx.client.getTaskLog(input),
  refresh: poll("10s"),
});
