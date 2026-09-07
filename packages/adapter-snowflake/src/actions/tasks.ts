import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";
import { taskDetails, tasks } from "../resources/tasks.js";

type Ctx = SnowflakeContext & ActionRuntimeContext;

const taskInput = z.object({
  database: z.string().min(1),
  schema: z.string().min(1),
  task: z.string().min(1),
});

function invalidateTask(ctx: Ctx, input: { database: string; schema: string }) {
  ctx.invalidate(tasks, { database: input.database, schema: input.schema });
  ctx.invalidate(taskDetails);
}

export const runTask = defineAction({
  id: "run-task",
  input: taskInput,
  run: async ({ database, schema, task }, ctx: Ctx) => {
    await ctx.client.runTask(database, schema, task);
    invalidateTask(ctx, { database, schema });
    return { database, schema, task, ran: true };
  },
});

export const suspendTask = defineAction({
  id: "suspend-task",
  input: taskInput,
  run: async ({ database, schema, task }, ctx: Ctx) => {
    await ctx.client.suspendTask(database, schema, task);
    invalidateTask(ctx, { database, schema });
    return { database, schema, task, status: "SUSPENDED" };
  },
});

export const resumeTask = defineAction({
  id: "resume-task",
  input: taskInput,
  run: async ({ database, schema, task }, ctx: Ctx) => {
    await ctx.client.resumeTask(database, schema, task);
    invalidateTask(ctx, { database, schema });
    return { database, schema, task, status: "STARTED" };
  },
});
