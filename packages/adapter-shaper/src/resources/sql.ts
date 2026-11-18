import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { ShaperContext } from "../context.js";
import { csvRecords } from "../csv.js";
import { assertReadOnlySql } from "../sql-guard.js";

const PREVIEW_ROWS = 200;

/** Read-only SQL against Shaper's DuckDB, for agents and other consumers. */
export const sqlPreview = defineResource({
  id: "sql-preview",
  description:
    "Run one read-only SQL statement (SELECT, WITH, DESCRIBE, SHOW, EXPLAIN, SUMMARIZE) against the Shaper DuckDB and return up to 200 rows as text. Writes are refused.",
  input: z.object({ sql: z.string().min(1) }),
  query: async ({ sql }, ctx: ShaperContext) => {
    const result = await ctx.client.runSql(assertReadOnlySql(sql));
    const rows = result.rows.slice(0, PREVIEW_ROWS);
    return {
      columns: result.columns,
      rows: csvRecords({ columns: result.columns, rows }),
      truncated: result.truncated || result.rows.length > PREVIEW_ROWS,
    };
  },
});
