import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext } from "../context.js";
import { connections, pools, variables } from "../resources/admin.js";

type Ctx = AirflowContext & ActionRuntimeContext;

export const createConnectionInput = z.object({
  connectionId: z.string().min(1).max(200),
  connectionType: z.string().min(1).max(200),
  host: z.string().optional().default(""),
  login: z.string().optional().default(""),
  schema: z.string().optional().default(""),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  password: z.string().optional().default(""),
  extra: z.string().optional().default(""),
  description: z.string().optional().default(""),
});

export const createConnection = defineAction({
  id: "create-connection",
  input: createConnectionInput,
  run: async (input, ctx: Ctx) => {
    const connection = await ctx.client.createConnection(input, ctx.signal);
    ctx.invalidate(connections);
    return connection;
  },
});

export const deleteConnection = defineAction({
  id: "delete-connection",
  input: z.object({ connectionId: z.string().min(1) }),
  run: async ({ connectionId }, ctx: Ctx) => {
    await ctx.client.deleteConnection(connectionId, ctx.signal);
    ctx.invalidate(connections);
    return { connectionId };
  },
});

export const createVariableInput = z.object({
  key: z.string().min(1).max(200),
  value: z.string(),
  description: z.string().optional().default(""),
});

export const createVariable = defineAction({
  id: "create-variable",
  input: createVariableInput,
  run: async (input, ctx: Ctx) => {
    const variable = await ctx.client.createVariable(input, ctx.signal);
    ctx.invalidate(variables);
    return variable;
  },
});

export const deleteVariable = defineAction({
  id: "delete-variable",
  input: z.object({ key: z.string().min(1) }),
  run: async ({ key }, ctx: Ctx) => {
    await ctx.client.deleteVariable(key, ctx.signal);
    ctx.invalidate(variables);
    return { key };
  },
});

export const createPoolInput = z.object({
  name: z.string().min(1).max(200),
  slots: z.coerce.number().int().min(0).max(1_000_000),
  description: z.string().optional().default(""),
});

export const createPool = defineAction({
  id: "create-pool",
  input: createPoolInput,
  run: async (input, ctx: Ctx) => {
    const pool = await ctx.client.createPool(input, ctx.signal);
    ctx.invalidate(pools);
    return pool;
  },
});

export const deletePool = defineAction({
  id: "delete-pool",
  input: z.object({ name: z.string().min(1) }),
  run: async ({ name }, ctx: Ctx) => {
    await ctx.client.deletePool(name, ctx.signal);
    ctx.invalidate(pools);
    return { name };
  },
});
