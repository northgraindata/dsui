import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { ShaperContext } from "../context.js";
import { csvRecords } from "../csv.js";

type Ctx = ShaperContext & ActionRuntimeContext;

export const runQueryInput = z.object({ sql: z.string().min(1) });

/**
 * Runs one SQL statement through `/api/sql`.
 *
 * Shaper delivers CSV without column types, so every cell is text. The
 * statement may change data, which is why the catalog is invalidated.
 */
export const runQuery = defineAction({
  id: "run-query",
  input: runQueryInput,
  run: async ({ sql }, ctx: Ctx) => {
    const started = Date.now();
    const result = await ctx.client.runSql(sql, ctx.signal);
    ctx.invalidate();
    return {
      columns: result.columns,
      rows: csvRecords(result),
      truncated: result.truncated,
      elapsedMs: Date.now() - started,
    };
  },
});
