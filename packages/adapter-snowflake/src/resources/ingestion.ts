import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";

const scopeInput = z.object({
  database: z.string(),
  schema: z.string(),
});

export const stages = defineResource({
  id: "stages",
  input: scopeInput,
  query: ({ database, schema }, ctx: SnowflakeContext) =>
    ctx.client.listStages(database, schema),
});

export const stageFiles = defineResource({
  id: "stage-files",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    stage: z.string(),
  }),
  query: ({ database, schema, stage }, ctx: SnowflakeContext) =>
    ctx.client.listStageFiles(database, schema, stage),
});

export const streams = defineResource({
  id: "streams",
  input: scopeInput,
  query: ({ database, schema }, ctx: SnowflakeContext) =>
    ctx.client.listStreams(database, schema),
  refresh: poll("60s"),
});

export const copyHistory = defineResource({
  id: "copy-history",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    table: z.string().nullable().default(null),
  }),
  query: ({ database, schema, table }, ctx: SnowflakeContext) =>
    ctx.client.listCopyHistory(database, schema, table),
  refresh: poll("30s"),
});

export const dynamicTables = defineResource({
  id: "dynamic-tables",
  input: scopeInput,
  query: ({ database, schema }, ctx: SnowflakeContext) =>
    ctx.client.listDynamicTables(database, schema),
  refresh: poll("30s"),
});

export const pipes = defineResource({
  id: "pipes",
  input: scopeInput,
  query: ({ database, schema }, ctx: SnowflakeContext) =>
    ctx.client.listPipes(database, schema),
  refresh: poll("30s"),
});
