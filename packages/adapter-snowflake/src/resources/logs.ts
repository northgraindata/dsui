import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";

/**
 * Poll-based log viewer. True streaming (`stream(...)`) is not an SDK
 * primitive yet, so live tailing is expressed as 10s polling over recent
 * activity. See COVERAGE.md.
 */
export const logFilterInput = z.object({
  search: z.string().default(""),
  level: z.string().nullable().default(null),
});

export const logs = defineResource({
  id: "logs",
  input: logFilterInput,
  query: (filter, ctx: SnowflakeContext) => ctx.client.listLogs(filter),
  refresh: poll("10s"),
});
