import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLContext } from "../context.js";

export const runQueryInput = z.object({
  sql: z.string().trim().min(1).max(100_000),
  maxRows: z.number().int().positive().max(10_000).default(1_000),
});

export const runQuery = defineAction({
  id: "run-query",
  input: runQueryInput,
  run: async (
    { sql, maxRows },
    ctx: PostgreSQLContext & ActionRuntimeContext,
  ) => {
    ctx.signal?.throwIfAborted();
    const result = await ctx.client.execute(sql, maxRows);
    ctx.signal?.throwIfAborted();
    return result;
  },
});
