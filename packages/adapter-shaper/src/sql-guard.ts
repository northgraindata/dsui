/**
 * Read-only check for SQL an AI agent or a preview page wants to run.
 *
 * Shaper's `/api/sql` also accepts statements with side effects, and the
 * resource declaration does not enforce read-only execution, so the adapter has
 * to. This is an allowlist of statement kinds plus a ban on keywords that can
 * write, load code or reach other files. It errs towards refusing.
 */
const READ_STARTS = /^(select|with|from|describe|show|explain|summarize)\b/i;
const FORBIDDEN =
  /\b(attach|detach|copy|export|import|install|load|create|drop|alter|insert|update|delete|truncate|merge|pragma|call|set|reset|checkpoint|vacuum|use)\b/i;

function stripLiteralsAndComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
}

/** Returns the trimmed statement, or throws with the reason it was refused. */
export function assertReadOnlySql(sql: string): string {
  const bare = stripLiteralsAndComments(sql)
    .trim()
    .replace(/;+\s*$/, "");
  if (bare === "") throw new Error("SQL is required");
  if (bare.includes(";")) throw new Error("Only one SQL statement is allowed");
  if (!READ_STARTS.test(bare))
    throw new Error(
      "Only read-only statements are allowed: SELECT, WITH, FROM, DESCRIBE, SHOW, EXPLAIN or SUMMARIZE",
    );
  const keyword = FORBIDDEN.exec(bare);
  if (keyword)
    throw new Error(
      `The keyword ${keyword[1]?.toUpperCase()} is not allowed in read-only SQL`,
    );
  return sql.trim().replace(/;+\s*$/, "");
}
