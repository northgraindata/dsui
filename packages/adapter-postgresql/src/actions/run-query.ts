import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLQueryResult } from "../client.js";
import type { PostgreSQLContext } from "../context.js";
import { queryFailed, querySucceeded } from "../signals.js";

export const runQueryInput = z.object({
  sql: z.string().trim().max(100_000).default(""),
  database: z.string().trim().min(1).optional(),
  maxRows: z.number().int().positive().max(10_000).default(1_000),
});

export const runQuery = defineAction({
  id: "run-query",
  description:
    "Run arbitrary SQL, including mutations, in the query editor. This is not a read-only resource.",
  input: runQueryInput,
  run: async (
    { sql, database, maxRows },
    ctx: PostgreSQLContext & ActionRuntimeContext,
  ) => {
    ctx.signal?.throwIfAborted();
    const normalizedSql = sql.trim();
    if (!normalizedSql) throw new Error("Enter a SQL query to run.");
    if (
      /\b(?:from|join)\s+(?:[a-z_][\w$]*\.){2}[a-z_][\w$]*/i.test(normalizedSql)
    ) {
      throw new Error(
        "PostgreSQL does not support cross-database references. Open a query for the target database and use schema.table.",
      );
    }
    const started = Date.now();
    let result: PostgreSQLQueryResult;
    try {
      result = await (database ? ctx.getClient(database) : ctx.client).execute(
        normalizedSql,
        maxRows,
      );
    } catch (error) {
      ctx.emit(queryFailed, {
        operation: sqlOperation(normalizedSql),
        database: database ?? ctx.config.database,
        durationMs: Date.now() - started,
        ...(errorCode(error) ? { errorCode: errorCode(error) } : {}),
      });
      throw error;
    }
    ctx.signal?.throwIfAborted();
    ctx.emit(querySucceeded, {
      operation: sqlOperation(normalizedSql),
      database: database ?? ctx.config.database,
      durationMs: Date.now() - started,
      rowCount: result.rowCount,
    });
    return result;
  },
});

function sqlOperation(sql: string): string {
  return (
    /^(?:select|insert|update|delete|merge|create|alter|drop|truncate|with|begin|commit|rollback|explain|call|do)\b/i
      .exec(sql)?.[0]
      .toUpperCase() ?? "OTHER"
  );
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error))
    return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}
