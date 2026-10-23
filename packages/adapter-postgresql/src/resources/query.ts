import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLContext } from "../context";
export const queryRows = defineResource({
  id: "query-rows",
  policy: "sql",
  description:
    "Execute one parameterized statement in a read-only transaction.",
  input: z.object({
    sql: z.string().trim().min(1).max(100000),
    parameters: z
      .array(z.union([z.string(), z.number().finite(), z.boolean(), z.null()]))
      .max(100)
      .default([]),
    maxRows: z.number().int().min(1).max(1000).default(100),
  }),
  query: async ({ sql, parameters, maxRows }, ctx: PostgreSQLContext) =>
    (await ctx.client.queryReadOnly(sql, parameters, maxRows)).rows,
});
