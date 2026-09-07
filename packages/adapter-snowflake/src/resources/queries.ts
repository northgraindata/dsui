import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";

export const queryFilterInput = z.object({
  warehouse: z.string().nullable(),
  status: z.string().nullable(),
  search: z.string().default(""),
});

export const queries = defineResource({
  id: "queries",
  input: queryFilterInput,
  query: (filter, ctx: SnowflakeContext) => ctx.client.listQueries(filter),
  refresh: poll("10s"),
});

export const queryDetails = defineResource({
  id: "query-details",
  input: z.object({ queryId: z.string() }),
  query: ({ queryId }, ctx: SnowflakeContext) => ctx.client.getQuery(queryId),
});

export const queryResults = defineResource({
  id: "query-results",
  input: z.object({ queryId: z.string() }),
  query: ({ queryId }, ctx: SnowflakeContext) =>
    ctx.client.getQueryResults(queryId),
});
