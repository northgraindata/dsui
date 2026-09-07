import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";

const scopeInput = z.object({
  database: z.string(),
  schema: z.string(),
});

export const functions = defineResource({
  id: "functions",
  input: scopeInput,
  query: ({ database, schema }, ctx: SnowflakeContext) =>
    ctx.client.listFunctions(database, schema),
});

export const procedures = defineResource({
  id: "procedures",
  input: scopeInput,
  query: ({ database, schema }, ctx: SnowflakeContext) =>
    ctx.client.listProcedures(database, schema),
});
