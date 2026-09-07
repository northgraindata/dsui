import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";
import { queries } from "../resources/queries.js";

type Ctx = SnowflakeContext & ActionRuntimeContext;

export const runQuery = defineAction({
  id: "run-query",
  input: z.object({
    sql: z.string().min(1),
    warehouse: z.string().nullable(),
    database: z.string().nullable(),
    schema: z.string().nullable(),
  }),
  // Long-running shape: the runtime tracks running/success/error per
  // execution and can later add progress/cancellation without API changes.
  run: async ({ sql, warehouse, database, schema }, ctx: Ctx) => {
    const result = await ctx.client.execute(sql, {
      warehouse,
      database,
      schema,
      role: ctx.config.role ?? null,
    });
    ctx.invalidate(queries);
    return result;
  },
});

export const cancelQuery = defineAction({
  id: "cancel-query",
  input: z.object({ queryId: z.string().min(1) }),
  run: async ({ queryId }, ctx: Ctx) => {
    await ctx.client.cancelQuery(queryId);
    ctx.invalidate(queries);
    return { queryId, status: "CANCELLED" };
  },
});
