import { defineAction, z } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "./context.js";

export const runQuery = defineAction({
  id: "run-query",
  input: z.object({
    sql: z.string().trim().max(100_000).default(""),
    // QueryEditor sends its labeled selector value in the `database` field.
    database: z.string().min(1).optional(),
    maxRows: z.number().int().positive().max(10_000).default(1_000),
  }),
  run: async (
    { sql, database: warehouse, maxRows },
    ctx: SnowflakeContext & { signal?: AbortSignal },
  ) => {
    if (!sql) throw new Error("Enter a SQL query to run.");
    if (!warehouse) throw new Error("Select a warehouse before running SQL.");
    ctx.signal?.throwIfAborted();
    const client = await ctx.getClient(warehouse);
    return client.execute(sql, maxRows, ctx.signal);
  },
});
