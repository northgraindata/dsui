import {
  type ActionRuntimeContext,
  defineAction,
  defineSignal,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import { qualified } from "./client.js";
import type { ClickHouseContext } from "./context.js";
import { catalogResources, tableInput } from "./resources.js";
import { quoteIdentifier, validateSql } from "./sql.js";

type Context = ClickHouseContext & ActionRuntimeContext;
const eventSchema = z.object({
  operation: z.string(),
  database: z.string(),
  durationMs: z.number(),
  rowCount: z.number().optional(),
});
export const querySucceeded = defineSignal({
  id: "query-succeeded",
  type: "success",
  schema: eventSchema,
});
export const queryFailed = defineSignal({
  id: "query-failed",
  type: "error",
  schema: eventSchema,
});
export const runQuery = defineAction({
  id: "run-query",
  input: z.object({
    sql: z.string().trim().min(1).max(100_000),
    database: z.string().min(1).optional(),
    maxRows: z.number().int().min(1).max(10_000).default(1000),
  }),
  run: async (input, ctx: Context) => {
    const operation = validateSql(input.sql);
    const started = Date.now();
    const database = input.database ?? ctx.config.database;
    try {
      const result = await ctx.client.execute(input.sql, {
        ...input,
        signal: ctx.signal,
      });
      ctx.emit(querySucceeded, {
        operation,
        database,
        durationMs: Date.now() - started,
        rowCount: result.rowCount,
      });
      for (const resource of catalogResources) ctx.invalidate(resource);
      return { ...result, elapsedMs: Date.now() - started };
    } catch (error) {
      ctx.emit(queryFailed, {
        operation,
        database,
        durationMs: Date.now() - started,
      });
      throw error;
    }
  },
});
export const cancelQuery = defineAction({
  id: "cancel-query",
  input: z.object({ queryId: z.string().min(1).max(256) }),
  run: async ({ queryId }, ctx: Context) => {
    const rows = await ctx.client.cancel(queryId);
    for (const resource of catalogResources) ctx.invalidate(resource);
    return {
      status: rows.length ? "server-reported" : "no-matching-query",
      rows,
    };
  },
});
export const createDatabaseInput = z.object({
  name: z.string().min(1).max(256),
});
export const createDatabase = defineAction({
  id: "create-database",
  input: createDatabaseInput,
  run: async ({ name }, ctx: Context) => {
    await ctx.client.execute(`CREATE DATABASE ${quoteIdentifier(name)}`, {
      signal: ctx.signal,
    });
    for (const resource of catalogResources) ctx.invalidate(resource);
    return { database: name };
  },
});
export const tableCommandInput = tableInput.extend({
  operation: z.enum(["truncate", "drop", "optimize", "reload-dictionary"]),
  confirmTarget: z.string(),
});
export const tableCommand = defineAction({
  id: "table-command",
  input: tableCommandInput,
  run: async (input, ctx: Context) => {
    if (input.confirmTarget !== `${input.database}.${input.table}`)
      throw new Error(
        "Type the full database.table name to confirm the operation.",
      );
    if (ctx.config.readOnly)
      throw new Error("This connection is configured read-only.");
    const target = qualified(input.database, input.table);
    const queries = {
      truncate: `TRUNCATE TABLE ${target}`,
      drop: `DROP TABLE ${target}`,
      optimize: `OPTIMIZE TABLE ${target}`,
      "reload-dictionary": `SYSTEM RELOAD DICTIONARY ${target}`,
    };
    await ctx.client.execute(queries[input.operation], {
      database: input.database,
      signal: ctx.signal,
    });
    for (const resource of catalogResources) ctx.invalidate(resource);
    return { status: "completed", operation: input.operation };
  },
});
export const actions = [runQuery, cancelQuery, createDatabase, tableCommand];
