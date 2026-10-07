import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";
import {
  databaseSize,
  databases,
  overview,
  relations,
  schemas,
  tables,
  views,
} from "../resources/catalog.js";
import { queryHistory } from "../resources/history.js";
import { queryFailed, querySucceeded } from "../signals.js";
import { queryHistoryStore } from "../stores/index.js";

type Ctx = DuckDbContext & ActionRuntimeContext;

export const runQueryInput = z.object({ sql: z.string().min(1) });

export const runQuery = defineAction({
  id: "run-query",
  description:
    "Run arbitrary SQL, including mutations and external access, in the query editor. This is not a read-only resource.",
  input: runQueryInput,
  run: async ({ sql }, ctx: Ctx) => {
    const started = Date.now();
    try {
      const result = await ctx.client.execute(sql, { signal: ctx.signal });
      const durationMs = Date.now() - started;
      ctx.stores.get(queryHistoryStore).actions.append({
        id: crypto.randomUUID(),
        sql,
        status: "SUCCESS",
        rows: result.rows.length,
        elapsedMs: Date.now() - started,
        startedAt: new Date(started).toISOString(),
      });
      ctx.invalidate(queryHistory);
      ctx.emit(querySucceeded, {
        operation: sqlOperation(sql),
        durationMs,
        rowCount: result.rows.length,
      });
      // The worksheet accepts arbitrary SQL, so a successful statement may have
      // changed any part of the catalog. Invalidating is intentionally broad here;
      // resources still reload lazily as their explorer branches become visible.
      ctx.invalidate(databases);
      ctx.invalidate(schemas);
      ctx.invalidate(relations);
      ctx.invalidate(tables);
      ctx.invalidate(views);
      ctx.invalidate(databaseSize);
      ctx.invalidate(overview);
      return { ...result, elapsedMs: durationMs };
    } catch (error) {
      ctx.stores.get(queryHistoryStore).actions.append({
        id: crypto.randomUUID(),
        sql,
        status: "ERROR",
        rows: 0,
        elapsedMs: Date.now() - started,
        startedAt: new Date(started).toISOString(),
        message: error instanceof Error ? error.message : "Query failed",
      });
      await ctx.stores.get(queryHistoryStore).flush();
      ctx.emit(queryFailed, {
        operation: sqlOperation(sql),
        durationMs: Date.now() - started,
        ...(errorCode(error) ? { errorCode: errorCode(error) } : {}),
      });
      throw error;
    }
  },
});

function sqlOperation(sql: string): string {
  return (
    /^(?:select|insert|update|delete|merge|create|alter|drop|truncate|with|begin|commit|rollback|explain|call|attach|detach|copy|install|load)\b/i
      .exec(sql.trim())?.[0]
      .toUpperCase() ?? "OTHER"
  );
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error))
    return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

export const cancelQuery = defineAction({
  id: "cancel-query",
  run: (_input, ctx: Ctx) => {
    ctx.client.interrupt();
    return { status: "CANCELLED" };
  },
});
