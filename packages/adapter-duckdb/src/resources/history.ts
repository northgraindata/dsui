import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";

export const queryHistory = defineResource({
  id: "query-history",
  input: z.object({
    search: z.string().optional(),
    status: z.string().nullable().optional().default(null),
  }),
  query: ({ search, status }, ctx: DuckDbContext) =>
    ctx.client.listQueryHistory({
      search: search ?? "",
      status: status ?? null,
    }),
  refresh: poll("10s"),
});
