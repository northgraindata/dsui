/**
 * Read-only check for SQL an AI agent or a preview page wants to run.
 *
 * Shaper's `/api/sql` also accepts statements with side effects, and the
 * resource declaration does not enforce read-only execution, so the adapter has
 * to. It errs towards refusing. Enforced, after comments and string literals
 * are tokenised away:
 * - a single statement that starts with SELECT, WITH, FROM, DESCRIBE, SHOW,
 *   EXPLAIN or SUMMARIZE;
 * - no keyword that writes, loads code or changes session state;
 * - no table function that reads files, URLs, secrets or settings (`read_*`,
 *   `*_scan`, `scan_*`, `parquet_*`, `glob`, `sniff_csv`, `query`,
 *   `query_table`, `getenv`, `current_setting`, `duckdb_secrets`,
 *   `which_secret`), and no quoted function names;
 * - no replacement scan: a string literal, or a quoted name that looks like a
 *   path, used as a table source after FROM or JOIN;
 * - no string literal that is a URL or names a data file (.csv, .parquet, ...).
 * Not covered: limits on resources or rows, which Shaper itself must apply.
 */
const READ_STARTS = /^(select|with|from|describe|show|explain|summarize)\b/i;
const FORBIDDEN =
  /\b(attach|detach|copy|export|import|install|load|create|drop|alter|insert|update|delete|truncate|merge|pragma|call|set|reset|checkpoint|vacuum|use)\b/i;
const FILE_FUNCTION =
  /\b(read_\w+|\w+_scan|scan_\w+|parquet_\w+|glob|sniff_csv|query_table|query|getenv|current_setting|duckdb_secrets|which_secret)\s*\(/i;
const QUOTED_CALL = /""\s*\(/;
const LITERAL_SOURCE = /\b(?:from|join)\s*\(*\s*''/i;
const QUOTED_SOURCE = /\b(?:from|join)\s*\(*\s*"(\d+)"/gi;
const DATA_FILE =
  /^[a-z][a-z0-9+.-]*:\/\/|\.(csv|tsv|txt|parquet|json|jsonl|ndjson|xlsx|arrow|db|duckdb|sqlite)(\.gz|\.zst)?$/i;

interface Tokenised {
  bare: string;
  literals: string[];
  identifiers: string[];
}

function tokenise(sql: string): Tokenised {
  let bare = "";
  const literals: string[] = [];
  const identifiers: string[] = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql.charAt(i);
    if (ch === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      bare += " ";
    } else if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      bare += " ";
    } else if (ch === "'" || ch === '"') {
      let text = "";
      i += 1;
      while (i < sql.length) {
        if (sql[i] === ch && sql[i + 1] === ch) {
          text += ch;
          i += 2;
        } else if (sql[i] === ch) {
          i += 1;
          break;
        } else {
          text += sql.charAt(i);
          i += 1;
        }
      }
      if (ch === "'") {
        literals.push(text);
        bare += "''";
      } else {
        identifiers.push(text);
        bare += `"${identifiers.length - 1}"`;
      }
    } else {
      bare += ch;
      i += 1;
    }
  }
  return { bare, literals, identifiers };
}

function assertNoFileAccess({ bare, literals, identifiers }: Tokenised): void {
  const fileFunction = FILE_FUNCTION.exec(bare);
  if (fileFunction)
    throw new Error(
      `The function ${fileFunction[1]?.toLowerCase()} is not allowed in read-only SQL`,
    );
  if (QUOTED_CALL.test(bare.replace(/"\d+"/g, '""')))
    throw new Error("Quoted function names are not allowed in read-only SQL");
  if (LITERAL_SOURCE.test(bare))
    throw new Error("A string literal cannot be used as a table source");
  for (const match of bare.matchAll(QUOTED_SOURCE)) {
    const name = identifiers[Number(match[1])] ?? "";
    if (/[/\\]/.test(name) || DATA_FILE.test(name))
      throw new Error("A file path cannot be used as a table source");
  }
  if (literals.some((text) => DATA_FILE.test(text)))
    throw new Error("File and URL references are not allowed in read-only SQL");
}

/** Returns the trimmed statement, or throws with the reason it was refused. */
export function assertReadOnlySql(sql: string): string {
  const tokens = tokenise(sql);
  const bare = tokens.bare.trim().replace(/;+\s*$/, "");
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
  assertNoFileAccess({ ...tokens, bare });
  return sql.trim().replace(/;+\s*$/, "");
}
