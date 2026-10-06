import {
  type ActionRuntimeContext,
  defineAction,
  defineSignal,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { TrinoContext } from "../context";
import { TrinoError } from "../sql";

const payload = z.object({
  operation: z.string(),
  durationMs: z.number(),
  queryId: z.string().optional(),
  rowCount: z.number().optional(),
  errorCode: z.string().optional(),
  warningCount: z.number().optional(),
});
export const querySucceeded = defineSignal({
  id: "query-succeeded",
  type: "success",
  schema: payload,
});
export const queryFailed = defineSignal({
  id: "query-failed",
  type: "error",
  schema: payload,
});
export const queryWarning = defineSignal({
  id: "query-warning",
  type: "warning",
  schema: payload,
});
export const runQuery = defineAction({
  id: "run-query",
  input: z.object({
    sql: z.string().trim().min(1).max(100000),
    catalog: z.string().min(1).optional(),
    schema: z.string().min(1).optional(),
    maxRows: z.number().int().min(1).max(10000).default(1000),
  }),
  run: async (input, ctx: TrinoContext & ActionRuntimeContext) => {
    const started = Date.now();
    const operation = /^[a-z]+/i.exec(input.sql)?.[0].toUpperCase() ?? "OTHER";
    try {
      const result = await ctx.client.execute(input.sql, {
        ...input,
        signal: ctx.signal,
      });
      const event = {
        operation,
        durationMs: result.elapsedMs,
        queryId: result.queryId,
        rowCount: result.rowCount,
      };
      ctx.emit(querySucceeded, event);
      if (result.warnings.length)
        ctx.emit(queryWarning, {
          ...event,
          warningCount: result.warnings.length,
        });
      return result;
    } catch (error) {
      ctx.emit(queryFailed, {
        operation,
        durationMs: Date.now() - started,
        ...(error instanceof TrinoError && error.code
          ? { errorCode: error.code }
          : {}),
      });
      throw error;
    }
  },
});
export const killQuery = defineAction({
  id: "kill-query",
  input: z.object({
    queryId: z.string().min(1),
    message: z.string().min(1).max(500).default("Cancelled from DSUI"),
  }),
  run: async ({ queryId, message }, ctx: TrinoContext) =>
    ctx.client.ui(
      `query/${encodeURIComponent(queryId)}/killed`,
      "PUT",
      message,
    ),
});
export const actions = [runQuery, killQuery];
export const signals = [querySucceeded, queryFailed, queryWarning];
