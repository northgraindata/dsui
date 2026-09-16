import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLContext } from "../context.js";
import { schemas } from "../resources/catalog.js";

export const createSchemaInput = z.object({
  schema: z.string().trim().min(1).max(63),
});

export const createSchema = defineAction({
  id: "create-schema",
  input: createSchemaInput,
  run: async ({ schema }, ctx: PostgreSQLContext & ActionRuntimeContext) => {
    await ctx.client.createSchema(schema);
    ctx.invalidate(schemas);
    return { schema, status: "created" as const };
  },
});

export const dropSchemaInput = z.object({
  schema: z.string().trim().min(1).max(63),
  cascade: z.boolean().default(false),
});

export const dropSchema = defineAction({
  id: "drop-schema",
  input: dropSchemaInput,
  run: async (
    { schema, cascade },
    ctx: PostgreSQLContext & ActionRuntimeContext,
  ) => {
    await ctx.client.dropSchema(schema, cascade);
    ctx.invalidate(schemas);
    return { schema, status: "dropped" as const };
  },
});
