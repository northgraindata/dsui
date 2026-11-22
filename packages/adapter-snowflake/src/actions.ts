import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import { WAREHOUSE_SIZES, type WarehouseChange } from "./client.js";
import type { SnowflakeContext } from "./context.js";
import { isReadOnlySql } from "./read-only.js";
import { activity, warehouses } from "./resources.js";
import { queryFailed, querySucceeded } from "./signals.js";

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
    ctx: SnowflakeContext & ActionRuntimeContext,
  ) => {
    if (!sql) throw new Error("Enter a SQL query to run.");
    if (!warehouse) throw new Error("Select a warehouse before running SQL.");
    if (ctx.config.readOnly && !isReadOnlySql(sql))
      throw new Error(
        "This connection is read-only; only SELECT, SHOW, DESCRIBE and EXPLAIN statements can run.",
      );
    ctx.signal?.throwIfAborted();
    const client = await ctx.getClient(warehouse);
    const started = Date.now();
    const payload = () => ({
      operation: sqlOperation(sql),
      warehouse,
      durationMs: Date.now() - started,
    });
    try {
      const result = await client.execute(sql, maxRows, ctx.signal);
      // A statement that may change objects makes cached catalog reads stale.
      if (!isReadOnlySql(sql)) ctx.cache.clear();
      ctx.emit(querySucceeded, { ...payload(), rowCount: result.rowCount });
      return result;
    } catch (error) {
      ctx.emit(queryFailed, {
        ...payload(),
        ...(errorCode(error) ? { errorCode: errorCode(error) } : {}),
      });
      throw error;
    }
  },
});

export const cancelQuery = defineAction({
  id: "cancel-query",
  input: z.object({ queryId: z.string().uuid() }),
  run: async ({ queryId }, ctx: SnowflakeContext & ActionRuntimeContext) => {
    if (ctx.config.readOnly)
      throw new Error(
        "This connection is read-only; queries cannot be canceled.",
      );
    ctx.signal?.throwIfAborted();
    await ctx.client.cancelQuery(queryId);
    ctx.invalidate(activity);
    return { queryId };
  },
});

const warehouseName = z.string().min(1);

async function changeWarehouse(
  ctx: SnowflakeContext & ActionRuntimeContext,
  warehouse: string,
  change: WarehouseChange,
) {
  if (ctx.config.readOnly)
    throw new Error(
      "This connection is read-only; warehouses cannot be changed.",
    );
  ctx.signal?.throwIfAborted();
  await ctx.client.alterWarehouse(warehouse, change);
  ctx.cache.clear();
  ctx.invalidate(warehouses);
  return { warehouse };
}

export const suspendWarehouse = defineAction({
  id: "suspend-warehouse",
  input: z.object({ warehouse: warehouseName }),
  run: ({ warehouse }, ctx: SnowflakeContext & ActionRuntimeContext) =>
    changeWarehouse(ctx, warehouse, { kind: "suspend" }),
});

export const resumeWarehouse = defineAction({
  id: "resume-warehouse",
  input: z.object({ warehouse: warehouseName }),
  run: ({ warehouse }, ctx: SnowflakeContext & ActionRuntimeContext) =>
    changeWarehouse(ctx, warehouse, { kind: "resume" }),
});

export const resizeWarehouseInput = z.object({
  warehouse: warehouseName,
  size: z.enum(WAREHOUSE_SIZES),
});

export const resizeWarehouse = defineAction({
  id: "resize-warehouse",
  input: resizeWarehouseInput,
  run: ({ warehouse, size }, ctx: SnowflakeContext & ActionRuntimeContext) =>
    changeWarehouse(ctx, warehouse, { kind: "resize", size }),
});

export const autoSuspendInput = z.object({
  warehouse: warehouseName,
  seconds: z.coerce.number().int().min(0).max(86_400),
});

export const setWarehouseAutoSuspend = defineAction({
  id: "set-warehouse-auto-suspend",
  input: autoSuspendInput,
  run: ({ warehouse, seconds }, ctx: SnowflakeContext & ActionRuntimeContext) =>
    changeWarehouse(ctx, warehouse, { kind: "auto-suspend", seconds }),
});

function sqlOperation(sql: string): string {
  return (
    /^(?:select|insert|update|delete|merge|create|alter|drop|truncate|with|show|describe|desc|use|call|copy|put|get|explain)\b/i
      .exec(sql)?.[0]
      .toUpperCase() ?? "OTHER"
  );
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error))
    return undefined;
  return typeof error.code === "string" || typeof error.code === "number"
    ? String(error.code)
    : undefined;
}
