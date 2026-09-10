export interface QueryResultView {
  columns: { name: string; type?: string }[];
  rows: Record<string, unknown>[];
  elapsedMs?: number;
  rowsChanged?: number;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseQueryResult(value: unknown): QueryResultView {
  if (!record(value) || !Array.isArray(value.rows) || !value.rows.every(record))
    throw new Error("Invalid query result: expected an array of records.");
  const names =
    value.columns === undefined
      ? Object.keys(value.rows[0] ?? {})
      : value.columns;
  if (
    !Array.isArray(names) ||
    !names.every((name): name is string => typeof name === "string")
  )
    throw new Error("Invalid query result: expected column names.");
  const types = value.columnTypes;
  if (
    types !== undefined &&
    (!Array.isArray(types) ||
      types.length !== names.length ||
      !types.every((type) => typeof type === "string"))
  )
    throw new Error(
      "Invalid query result: column types must match the columns.",
    );
  return {
    columns: names.map((name, index) => ({
      name,
      ...(Array.isArray(types) ? { type: types[index] } : {}),
    })),
    rows: value.rows,
    ...(typeof value.elapsedMs === "number" &&
    Number.isFinite(value.elapsedMs) &&
    value.elapsedMs >= 0
      ? { elapsedMs: value.elapsedMs }
      : {}),
    ...(typeof value.rowsChanged === "number"
      ? { rowsChanged: value.rowsChanged }
      : {}),
  };
}

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function queryCsv(result: QueryResultView): string {
  const escapeCell = (value: unknown) => {
    let text = cellText(value);
    if (typeof value === "string" && /^[\s]*[=+@\-\t\r]/.test(value))
      text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [
    result.columns.map((column) => escapeCell(column.name)).join(","),
    ...result.rows.map((row) =>
      result.columns.map((column) => escapeCell(row[column.name])).join(","),
    ),
  ].join("\r\n");
}

export function elapsedLabel(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}
