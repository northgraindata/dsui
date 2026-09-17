import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLContext } from "../context.js";

export const runQueryInput = z.object({
  sql: z.string().trim().max(100_000).default(""),
  database: z.string().trim().min(1).optional(),
  maxRows: z.number().int().positive().max(10_000).default(1_000),
});

export const runQuery = defineAction({
  id: "run-query",
  input: runQueryInput,
  run: async (
    { sql, database, maxRows },
    ctx: PostgreSQLContext & ActionRuntimeContext,
  ) => {
    ctx.signal?.throwIfAborted();
    const normalizedSql = sql.trim();
    if (!normalizedSql) throw new Error("Enter a SQL query to run.");
    if (/\b(?:from|join)\s+(?:[a-z_][\w$]*\.){2}[a-z_][\w$]*/i.test(normalizedSql)) {
      throw new Error(
        "PostgreSQL does not support cross-database references. Open a query for the target database and use schema.table.",
      );
    }
    const result = await (database ? ctx.getClient(database) : ctx.client).execute(
      normalizedSql,
      maxRows,
    );
    ctx.signal?.throwIfAborted();
    return result;
  },
});
