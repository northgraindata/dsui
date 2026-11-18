const simpleIdentifier = /^[A-Za-z_][A-Za-z0-9_$]*$/;
const reserved = new Set([
  "AS",
  "DATABASE",
  "FROM",
  "GROUP",
  "JOIN",
  "LIMIT",
  "ORDER",
  "SCHEMA",
  "SELECT",
  "TABLE",
  "USER",
  "WHERE",
]);

export function qualifiedSqlName(
  labels: readonly string[],
  omitDatabase = false,
): string {
  const parts = omitDatabase && labels.length > 1 ? labels.slice(1) : labels;
  return parts
    .map((part) =>
      simpleIdentifier.test(part) && !reserved.has(part.toUpperCase())
        ? part
        : `"${part.replaceAll('"', '""')}"`,
    )
    .join(".");
}

export function identifierInsertion(
  sql: string,
  start: number,
  end: number,
  name: string,
): string {
  const before = sql.slice(0, start);
  const after = sql.slice(end);
  const prefix = /[A-Za-z0-9_$"]$/.test(before) ? " " : "";
  const suffix = /^[A-Za-z0-9_$"]/.test(after) ? " " : "";
  return `${prefix}${name}${suffix}`;
}

export function sqlOffset(sql: string, line: number, column: number): number {
  const lines = sql.split("\n");
  return (
    lines
      .slice(0, line - 1)
      .reduce((offset, part) => offset + part.length + 1, 0) +
    column -
    1
  );
}
