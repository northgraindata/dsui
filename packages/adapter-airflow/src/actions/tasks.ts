import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext, TaskInstanceRef } from "../context.js";
import {
  dagRunDetails,
  dagRuns,
  taskInstanceDetails,
  taskInstanceInput,
  taskInstances,
  taskLog,
} from "../resources/runs.js";

type Ctx = AirflowContext & ActionRuntimeContext;

function invalidateTask(ctx: Ctx, input: TaskInstanceRef) {
  const runInput = { dagId: input.dagId, dagRunId: input.dagRunId };
  ctx.invalidate(dagRuns, { dagId: input.dagId });
  ctx.invalidate(dagRunDetails, runInput);
  ctx.invalidate(taskInstances, runInput);
  ctx.invalidate(taskInstanceDetails, input);
  ctx.invalidate(taskLog);
}

export const retryTaskInput = taskInstanceInput.extend({
  state: z.literal("failed"),
});

export const retryTask = defineAction({
  id: "retry-task",
  input: retryTaskInput,
  run: async ({ dagId, dagRunId, taskId, mapIndex }, ctx: Ctx) => {
    const input = { dagId, dagRunId, taskId, mapIndex };
    await ctx.client.clearTaskInstance(input, true, ctx.signal);
    invalidateTask(ctx, input);
    return { ...input, operation: "retry" as const };
  },
});

export const clearTask = defineAction({
  id: "clear-task",
  input: taskInstanceInput,
  run: async (input, ctx: Ctx) => {
    await ctx.client.clearTaskInstance(input, false, ctx.signal);
    invalidateTask(ctx, input);
    return { ...input, operation: "clear" as const };
  },
});
