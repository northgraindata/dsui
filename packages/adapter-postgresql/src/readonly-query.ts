import { Buffer } from "node:buffer";
import postgres from "postgres";
import { sslOption } from "./connection-options.js";
import type { PostgreSQLConfig } from "./context.js";

/** Only policy errors authored here may be shown to the model. */
export class QueryPolicyError extends Error {}

const allowedFunctions = new Set([
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "abs",
  "round",
  "ceil",
  "ceiling",
  "floor",
  "sqrt",
  "power",
  "mod",
  "coalesce",
  "nullif",
  "greatest",
  "least",
  "lower",
  "upper",
  "length",
  "char_length",
  "trim",
  "btrim",
  "ltrim",
  "rtrim",
  "substring",
  "replace",
  "concat",
  "concat_ws",
  "left",
  "right",
  "split_part",
  "date_trunc",
  "date_part",
  "extract",
  "to_char",
  "to_date",
  "now",
  "row_number",
  "rank",
  "dense_rank",
  "lag",
  "lead",
  "first_value",
  "last_value",
  "bool_and",
  "bool_or",
  "string_agg",
  "array_agg",
  "json_agg",
  "jsonb_agg",
  "json_build_object",
  "jsonb_build_object",
  "json_array_length",
  "jsonb_array_length",
  // SQL grammar constructs followed by parentheses, not callable functions.
  "select",
  "from",
  "where",
  "as",
  "in",
  "exists",
  "not",
  "and",
  "or",
  "over",
  "filter",
  "partition",
  "by",
  "cast",
  "distinct",
  "on",
  "values",
  "with",
  "having",
  "group",
  "order",
  "join",
  "using",
  "any",
  "all",
]);

/** Conservative syntax gate; PostgreSQL's READ ONLY transaction enforces no DML/DDL. */
export function validateReadOnlySql(query: string) {
  if (!/^\s*(select|with)\b/i.test(query) || /;|--|\/\*|\*\/|\$|\\/.test(query))
    throw new QueryPolicyError(
      "Use one SELECT/WITH query without semicolons, comments, dollar quoting or backslashes",
    );
  const source = query.replace(/'(?:[^']|'')*'/g, "''");
  if (/"(?:[^"]|"")*"\s*\(/.test(source))
    throw new QueryPolicyError(
      "Quoted function calls are not supported by agent SQL",
    );
  const unquoted = source.replace(/"(?:[^"]|"")*"/g, '"identifier"');
  if (Array.from(unquoted).some((character) => character.charCodeAt(0) > 127))
    throw new QueryPolicyError(
      "Use ASCII SQL keywords and quote non-ASCII identifiers",
    );
  for (const match of unquoted.matchAll(
    /\b([a-z_][\w]*)(?:\s*\.\s*([a-z_][\w]*))?\s*\(/gi,
  )) {
    const namespace = match[2] ? match[1]?.toLowerCase() : undefined;
    const name = (match[2] ?? match[1] ?? "").toLowerCase();
    if (
      (namespace && namespace !== "pg_catalog") ||
      !allowedFunctions.has(name)
    )
      throw new QueryPolicyError(
        "Agent SQL supports only allowlisted built-in functions",
      );
  }
}

export async function executeReadOnlyQuery(
  config: PostgreSQLConfig,
  query: string,
  maxRows: number,
  timeoutMs: number,
) {
  validateReadOnlySql(query);
  // A dedicated short-lived session prevents user SQL from altering pooled session state.
  const sql = postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    ssl: sslOption(config),
    max: 1,
    connect_timeout: config.connectTimeout,
    connection: {
      application_name: "dsui-agent-readonly",
      statement_timeout: Math.min(timeoutMs, config.statementTimeout),
    },
  });
  try {
    return await sql.begin("read only", async (tx) => {
      await tx`select set_config('search_path', 'pg_catalog', true)`;
      await tx`select set_config('statement_timeout', ${String(Math.min(timeoutMs, config.statementTimeout))}, true)`;
      await tx`select set_config('lock_timeout', '1000', true)`;
      const [role] = await tx<{ unsafe: boolean }[]>`
        select rolsuper or rolcreaterole or rolcreatedb or rolreplication or rolbypassrls
          or pg_has_role(current_user, 'pg_read_server_files', 'MEMBER')
          or pg_has_role(current_user, 'pg_write_server_files', 'MEMBER')
          or pg_has_role(current_user, 'pg_execute_server_program', 'MEMBER') as unsafe
        from pg_roles where rolname = current_user
      `;
      if (!role || role.unsafe)
        throw new QueryPolicyError(
          "Agent SQL requires a dedicated non-privileged database role",
        );
      const result = await tx.unsafe<Record<string, unknown>[]>(
        `select * from (${query}\n) as dsui_agent_result limit ${maxRows + 1}`,
        [],
        { prepare: true },
      );
      const columns = result.columns.map((column) => column.name);
      if (new Set(columns).size !== columns.length)
        throw new QueryPolicyError("Use unique output column aliases");
      const serialized = JSON.stringify(
        result.slice(0, maxRows),
        (_key, value: unknown) =>
          typeof value === "bigint" ? value.toString() : value,
      );
      if (Buffer.byteLength(serialized) > 1024 * 1024)
        throw new QueryPolicyError(
          "Agent SQL result exceeds 1 MB; return fewer or smaller values",
        );
      const rows: Record<string, unknown>[] = JSON.parse(serialized);
      return {
        columns,
        columnTypes: result.columns.map((column) => `oid:${column.type}`),
        rows,
        rowCount: rows.length,
        truncated: result.length > maxRows,
      };
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}
