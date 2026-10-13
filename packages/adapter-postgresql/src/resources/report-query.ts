import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLContext } from "../context.js";

/** Dashboard SQL is executed by the client in a bounded read-only transaction. */
export const reportQuery = defineResource({
  id: "report-query",
  input: z.object({
    sql: z.string().trim().min(1).max(20_000),
    maxRows: z.number().int().min(1).max(1_000).default(100),
    parameters: z
      .array(z.union([z.string(), z.number().finite(), z.boolean(), z.null()]))
      .max(20)
      .default([]),
  }),
  query: async ({ sql, maxRows, parameters }, ctx: PostgreSQLContext) =>
    (await ctx.client.executeReadOnly(sql, maxRows, parameters)).rows,
});
