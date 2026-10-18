function skipQuoted(sql: string, start: number): number {
  const quote = sql[start];
  let cursor = start + 1;
  while (cursor < sql.length) {
    if (sql[cursor] === "\\") {
      cursor += 2;
      continue;
    }
    if (sql[cursor++] !== quote) continue;
    if (sql[cursor] !== quote) return cursor;
    cursor++;
  }
  throw new Error("Unterminated SQL string or identifier.");
}
function skipDelimited(
  sql: string,
  start: number,
  delimiter: { open: string; close: string; label: string },
): number {
  const { open, close, label } = delimiter;
  const end = sql.indexOf(close, start + open.length);
  if (end < 0) throw new Error(`Unterminated SQL ${label}.`);
  return end + close.length;
}
function lexSql(sql: string): string[] {
  const tokens: string[] = [];
  let cursor = 0;
  while (cursor < sql.length) {
    const rest = sql.slice(cursor);
    const space = /^(?:\s+|--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$))/.exec(rest);
    if (space) {
      cursor += space[0].length;
      continue;
    }
    if (rest.startsWith("/*")) {
      cursor = skipDelimited(sql, cursor, {
        open: "/*",
        close: "*/",
        label: "comment",
      });
      continue;
    }
    if (tokens.includes(";"))
      throw new Error("Run one SQL statement at a time.");
    const char = sql[cursor];
    const delimiter = /^\$[A-Za-z_0-9]*\$/.exec(rest)?.[0];
    if (delimiter) {
      cursor = skipDelimited(sql, cursor, {
        open: delimiter,
        close: delimiter,
        label: "heredoc",
      });
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      cursor = skipQuoted(sql, cursor);
      continue;
    }
    const token = /^[A-Za-z_][A-Za-z_0-9]*|^;/.exec(rest)?.[0];
    if (token) tokens.push(token.toUpperCase());
    cursor += token?.length ?? 1;
  }
  return tokens;
}
/** This validates the editor's transport contract; server roles authorize SQL. */
export function validateSql(sql: string): string {
  const tokens = lexSql(sql);
  if (!tokens.length || tokens[0] === ";")
    throw new Error("Enter a SQL statement.");
  if (tokens.includes("FORMAT"))
    throw new Error(
      "Remove the explicit FORMAT clause; DSUI manages the result format.",
    );
  if (tokens.includes("OUTFILE"))
    throw new Error("Use result export instead of INTO OUTFILE.");
  return tokens[0];
}
export function quoteIdentifier(value: string) {
  if (!value || value.includes("\0"))
    throw new Error("Invalid database object name.");
  return `\`${value.replaceAll("\\", "\\\\").replaceAll("`", "\\`")}\``;
}
