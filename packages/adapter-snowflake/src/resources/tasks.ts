import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";

const taskScope = z.object({
  database: z.string(),
  schema: z.string(),
});

export const tasks = defineResource({
  id: "tasks",
  input: taskScope,
  query: ({ database, schema }, ctx: SnowflakeContext) =>
    ctx.client.listTasks(database, schema),
  refresh: poll("10s"),
});

export const taskDetails = defineResource({
  id: "task-details",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    task: z.string(),
  }),
  query: ({ database, schema, task }, ctx: SnowflakeContext) =>
    ctx.client.getTask(database, schema, task),
  refresh: poll("10s"),
});

export const taskHistory = defineResource({
  id: "task-history",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    task: z.string(),
  }),
  query: ({ database, schema, task }, ctx: SnowflakeContext) =>
    ctx.client.taskHistory(database, schema, task),
  refresh: poll("10s"),
});
