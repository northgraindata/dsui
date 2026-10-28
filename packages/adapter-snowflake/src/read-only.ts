const READ_ONLY_STATEMENTS = new Set([
  "SELECT",
  "WITH",
  "SHOW",
  "DESCRIBE",
  "DESC",
  "EXPLAIN",
  "LIST",
  "LS",
  "USE",
]);

function stripLeadingComments(sql: string): string {
  let rest = sql.trimStart();
  for (;;) {
    if (rest.startsWith("--") || rest.startsWith("//")) {
      const end = rest.indexOf("\n");
      rest = end === -1 ? "" : rest.slice(end + 1).trimStart();
    } else if (rest.startsWith("/*")) {
      const end = rest.indexOf("*/");
      rest = end === -1 ? "" : rest.slice(end + 2).trimStart();
    } else return rest;
  }
}

/** True when the statement only reads (the first keyword decides; Snowflake runs one statement per call). */
export function isReadOnlySql(sql: string): boolean {
  const keyword = /^[A-Za-z]+/.exec(stripLeadingComments(sql))?.[0];
  return (
    keyword !== undefined && READ_ONLY_STATEMENTS.has(keyword.toUpperCase())
  );
}
