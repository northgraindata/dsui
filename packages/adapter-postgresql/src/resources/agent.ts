import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLContext } from "../context.js";
import { QueryPolicyError } from "../readonly-query.js";

export const catalogInput = z.object({
  database: z.string().min(1),
  schema: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  query: z.string().max(200).default(""),
  minColumns: z.number().int().min(0).max(10_000).default(0),
  maxColumns: z.number().int().min(0).max(10_000).optional(),
  offset: z.number().int().min(0).max(1_000_000).default(0),
  limit: z.number().int().min(1).max(50).default(25),
});
export type CatalogInput = z.output<typeof catalogInput>;
export type CatalogTable = {
  database: string;
  schema: string;
  name: string;
  kind: "table" | "view" | "materialized-view" | "foreign-table";
  description: string | null;
  columnCount: number;
  estimatedRows: number | null;
  matchedColumns: string[];
};
export const catalogTables = defineResource({
  id: "catalog-tables",
  input: catalogInput,
  query: async (input, ctx: PostgreSQLContext) => {
    const rows = await ctx.getClient(input.database).searchCatalog(input);
    return {
      items: rows.slice(0, input.limit),
      nextOffset: rows.length > input.limit ? input.offset + input.limit : null,
    };
  },
});

export const agentReadonlyQueryInput = z.object({
  database: z.string().min(1),
  sql: z.string().trim().min(1).max(20_000),
  maxRows: z.number().int().min(1).max(200).default(50),
  timeoutMs: z.number().int().min(100).max(10_000).default(5_000),
});
export const agentReadonlyQuery = defineResource({
  id: "agent-readonly-query",
  policy: "sql",
  input: agentReadonlyQueryInput,
  query: async (input, ctx: PostgreSQLContext) => {
    if (!ctx.config.allowAgentSql)
      throw new Error("Agent SQL is not enabled for this service");
    try {
      return {
        ok: true as const,
        data: await ctx
          .getClient(input.database)
          .executeReadOnly(input.sql, input.maxRows, input.timeoutMs),
      };
    } catch (cause) {
      return {
        ok: false as const,
        error:
          cause instanceof QueryPolicyError
            ? cause.message
            : "Query failed or timed out. Check SELECT syntax, explicit schemas, database access and the configured read-only role",
      };
    }
  },
});

export const agentSqlCapabilities = defineResource({
  id: "agent-sql-capabilities",
  query: (_, ctx: PostgreSQLContext) => ({ enabled: ctx.config.allowAgentSql }),
});
