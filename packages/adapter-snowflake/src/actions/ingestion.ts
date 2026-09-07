import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";
import { dynamicTables, pipes } from "../resources/ingestion.js";
import { queries } from "../resources/queries.js";

type Ctx = SnowflakeContext & ActionRuntimeContext;

const dynamicTableInput = z.object({
  database: z.string().min(1),
  schema: z.string().min(1),
  name: z.string().min(1),
});

export const suspendDynamicTable = defineAction({
  id: "suspend-dynamic-table",
  input: dynamicTableInput,
  run: async ({ database, schema, name }, ctx: Ctx) => {
    await ctx.client.suspendDynamicTable(database, schema, name);
    ctx.invalidate(dynamicTables, { database, schema });
    return { database, schema, name, status: "SUSPENDED" };
  },
});

export const resumeDynamicTable = defineAction({
  id: "resume-dynamic-table",
  input: dynamicTableInput,
  run: async ({ database, schema, name }, ctx: Ctx) => {
    await ctx.client.resumeDynamicTable(database, schema, name);
    ctx.invalidate(dynamicTables, { database, schema });
    return { database, schema, name, status: "ACTIVE" };
  },
});

export const executeProcedureInput = z.object({
  database: z.string().min(1),
  schema: z.string().min(1),
  name: z.string().min(1),
  args: z.string().default(""),
});

export const executeProcedure = defineAction({
  id: "execute-procedure",
  input: executeProcedureInput,
  run: async ({ database, schema, name, args }, ctx: Ctx) => {
    const result = await ctx.client.executeProcedure(
      database,
      schema,
      name,
      args,
    );
    ctx.invalidate(queries);
    return result;
  },
});

const pipeInput = z.object({
  database: z.string().min(1),
  schema: z.string().min(1),
  pipe: z.string().min(1),
});

export const pausePipe = defineAction({
  id: "pause-pipe",
  input: pipeInput,
  run: async ({ database, schema, pipe }, ctx: Ctx) => {
    await ctx.client.pausePipe(database, schema, pipe);
    ctx.invalidate(pipes, { database, schema });
    return { database, schema, pipe, status: "PAUSED" };
  },
});

export const resumePipe = defineAction({
  id: "resume-pipe",
  input: pipeInput,
  run: async ({ database, schema, pipe }, ctx: Ctx) => {
    await ctx.client.resumePipe(database, schema, pipe);
    ctx.invalidate(pipes, { database, schema });
    return { database, schema, pipe, status: "RUNNING" };
  },
});
