import type { Shape } from "./types";
import { sampleNumber, sampleString } from "./values";

const COLUMNS = [
  { name: "order_id", type: "BIGINT" },
  { name: "customer", type: "VARCHAR" },
  { name: "status", type: "VARCHAR" },
  { name: "total_bytes", type: "BIGINT" },
  { name: "created_at", type: "TIMESTAMP" },
] as const;

/**
 * What every `run-query` action returns to the SQL editor and notebooks. The
 * editor rejects other shapes, so this one is written rather than sampled.
 */
export function queryResult({ rows, longText }: Shape): unknown {
  return {
    columns: COLUMNS.map((column) => column.name),
    columnTypes: COLUMNS.map((column) => column.type),
    rows: Array.from({ length: rows }, (_, row) =>
      Object.fromEntries(
        COLUMNS.map(({ name, type }) => [
          name,
          type === "BIGINT"
            ? sampleNumber(name, row, longText)
            : sampleString(name, row, longText),
        ]),
      ),
    ),
    elapsedMs: 42,
  };
}
