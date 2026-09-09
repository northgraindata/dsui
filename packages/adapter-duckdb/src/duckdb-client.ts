import type { DuckDBConnection } from "@duckdb/node-api";
import { DuckDBInstance } from "@duckdb/node-api";
import type {
  DuckDbClient,
  DuckDbConfig,
  QueryHistoryEntry,
  QueryResult,
} from "./context.js";

const MAX_ROWS = 10_000;

/**
 * Real DuckDB client over `@duckdb/node-api`. Each instance owns one
 * `DuckDBInstance` and one connection; `dispose` closes both. Results are
 * read with the client's JSON conversion, which yields browser-safe values
 * (BIGINT/HUGEINT/DECIMAL -> string, DATE -> "YYYY-MM-DD", nested lists and
 * structs preserved).
 */
export function createDuckDbClient(config: DuckDbConfig): DuckDbClient {
  let instance: DuckDBInstance | undefined;
  let connection: DuckDBConnection | undefined;
  const history: QueryHistoryEntry[] = [];
  let historySeq = 0;

  const qualifier = (database: string, schema: string): string =>
    `${quote(database)}.${quote(schema)}`;
  const qualified = (database: string, schema: string, name: string): string =>
    `${qualifier(database, schema)}.${quote(name)}`;

  async function connect(): Promise<DuckDBConnection> {
    if (connection) return connection;
    const options: Record<string, string> = {};
    if (config.readOnly) options.access_mode = "READ_ONLY";
    const target = config.path ?? config.url ?? ":memory:";
    instance = await DuckDBInstance.create(target, options);
    connection = await instance.connect();
    if (config.url) await attachRemote(connection);
    return connection;
  }

  async function attachRemote(conn: DuckDBConnection): Promise<void> {
    const url = config.url;
    if (!url) return;
    const secretClauses: string[] = [];
    if (config.s3AccessKeyId)
      secretClauses.push(`KEY_ID '${escapeString(config.s3AccessKeyId)}'`);
    if (config.s3SecretAccessKey)
      secretClauses.push(`SECRET '${escapeString(config.s3SecretAccessKey)}'`);
    if (config.s3SessionToken)
      secretClauses.push(
        `SESSION_TOKEN '${escapeString(config.s3SessionToken)}'`,
      );
    if (config.s3Region)
      secretClauses.push(`REGION '${escapeString(config.s3Region)}'`);
    if (config.s3Endpoint)
      secretClauses.push(`ENDPOINT '${escapeString(config.s3Endpoint)}'`);
    const createSecret = secretClauses.length
      ? `CREATE SECRET (TYPE S3 ${secretClauses.join(" ")});`
      : "";
    if (createSecret) await conn.run(createSecret);
  }

  async function read(
    sql: string,
    values?: (string | number | boolean | null)[],
  ): Promise<QueryResult> {
    const conn = await connect();
    const reader = await conn.runAndReadAll(sql, values);
    if (reader.currentRowCount > MAX_ROWS)
      throw new Error("Result exceeds row limit; narrow the query with LIMIT");
    await reader.readAll();
    const rows = reader.getRowObjectsJson() as Record<string, unknown>[];
    return { columns: reader.columnNames(), rows };
  }

  async function run(sql: string): Promise<number> {
    const conn = await connect();
    const result = await conn.run(sql);
    return result.rowsChanged;
  }

  async function record(
    sql: string,
    fn: () => Promise<QueryResult>,
  ): Promise<QueryResult> {
    const started = Date.now();
    try {
      const result = await fn();
      history.unshift({
        id: String(++historySeq),
        sql,
        status: "SUCCESS",
        rows: result.rows.length,
        elapsedMs: Date.now() - started,
        startedAt: new Date(started).toISOString(),
      });
      return result;
    } catch (error) {
      history.unshift({
        id: String(++historySeq),
        sql,
        status: "ERROR",
        rows: 0,
        elapsedMs: Date.now() - started,
        startedAt: new Date(started).toISOString(),
        message: error instanceof Error ? error.message : "Query failed",
      });
      throw error;
    }
  }

  return {
    dispose() {
      connection?.closeSync();
      connection = undefined;
      instance?.closeSync();
      instance = undefined;
    },
    interrupt() {
      connection?.interrupt();
    },
    async getOverview() {
      const result = await read(`
        SELECT
          version() AS version,
          (SELECT count(*) FROM duckdb_databases()
            WHERE database_name NOT IN ('system', 'temp')) AS databases,
          (SELECT count(*) FROM duckdb_tables()) AS tables,
          (SELECT count(*) FROM duckdb_views()) AS views,
          (SELECT count(*) FROM duckdb_extensions() WHERE installed) AS extensions
      `);
      const row = result.rows[0] ?? {};
      return {
        version: String(row.version ?? ""),
        databases: Number(row.databases ?? 0),
        tables: Number(row.tables ?? 0),
        views: Number(row.views ?? 0),
        extensions: Number(row.extensions ?? 0),
      };
    },
    async listDatabases() {
      const result = await read(
        `SELECT database_name, path, internal, readonly FROM duckdb_databases() ORDER BY database_name`,
      );
      return result.rows.map((row) => ({
        name: String(row.database_name),
        path: row.path === null ? null : String(row.path),
        internal: Boolean(row.internal),
        readonly: Boolean(row.readonly),
      }));
    },
    async getDatabase(database) {
      const databases = await this.listDatabases();
      return databases.find((db) => db.name === database) ?? null;
    },
    async databaseSize(database) {
      const sql = database
        ? `SELECT database_name AS name, database_size FROM pragma_database_size() WHERE database_name = ?`
        : `SELECT database_name AS name, database_size FROM pragma_database_size()`;
      return read(sql, database ? [database] : []);
    },
    async listSchemas(database) {
      const result = await read(
        `SELECT schema_name FROM duckdb_schemas() WHERE database_name = ? ORDER BY schema_name`,
        [database],
      );
      return result.rows.map((row) => ({
        database,
        name: String(row.schema_name),
      }));
    },
    async listTables(database, schema) {
      const result = await read(
        `SELECT table_name, sql FROM duckdb_tables() WHERE database_name = ? AND schema_name = ? ORDER BY table_name`,
        [database, schema],
      );
      return result.rows.map((row) => ({
        database,
        schema,
        name: String(row.table_name),
        type: "BASE TABLE",
      }));
    },
    async listViews(database, schema) {
      const result = await read(
        `SELECT view_name FROM duckdb_views() WHERE database_name = ? AND schema_name = ? ORDER BY view_name`,
        [database, schema],
      );
      return result.rows.map((row) => ({
        database,
        schema,
        name: String(row.view_name),
      }));
    },
    async getColumns(database, schema, table) {
      const result = await read(
        `SELECT column_name, data_type, is_nullable FROM duckdb_columns() WHERE database_name = ? AND schema_name = ? AND table_name = ? ORDER BY column_index`,
        [database, schema, table],
      );
      return result.rows.map((row) => ({
        name: String(row.column_name),
        type: String(row.data_type),
        nullable: row.is_nullable !== false,
      }));
    },
    async previewTable(database, schema, table, limit = 100) {
      return read(
        `SELECT * FROM ${qualified(database, schema, table)} LIMIT ${Math.max(1, Math.min(limit, MAX_ROWS))}`,
      );
    },
    async getTableDdl(database, schema, table) {
      const result = await read(
        `SELECT sql FROM duckdb_tables() WHERE database_name = ? AND schema_name = ? AND table_name = ?`,
        [database, schema, table],
      );
      const sql = result.rows[0]?.sql;
      return sql === null || sql === undefined ? "" : String(sql);
    },
    async getViewDdl(database, schema, view) {
      const result = await read(
        `SELECT sql FROM duckdb_views() WHERE database_name = ? AND schema_name = ? AND view_name = ?`,
        [database, schema, view],
      );
      const sql = result.rows[0]?.sql;
      return sql === null || sql === undefined ? "" : String(sql);
    },
    async summarizeTable(database, schema, table) {
      return read(`SUMMARIZE ${qualified(database, schema, table)}`);
    },
    async listSequences(database, schema) {
      const result = await read(
        `SELECT sequence_name FROM duckdb_sequences() WHERE database_name = ? AND schema_name = ? ORDER BY sequence_name`,
        [database, schema],
      );
      return result.rows.map((row) => ({
        database,
        schema,
        name: String(row.sequence_name),
      }));
    },
    async listIndexes(database, schema) {
      const result = await read(
        `SELECT index_name, table_name, sql FROM duckdb_indexes() WHERE database_name = ? AND schema_name = ? ORDER BY index_name`,
        [database, schema],
      );
      return result.rows.map((row) => ({
        database,
        schema,
        name: String(row.index_name),
        table: String(row.table_name ?? ""),
        sql: String(row.sql ?? ""),
      }));
    },
    async listMacros(database, schema) {
      const result = await read(
        `SELECT function_name, parameters, macro_definition FROM duckdb_functions() WHERE database_name = ? AND schema_name = ? AND function_type = 'macro' ORDER BY function_name`,
        [database, schema],
      );
      return result.rows.map((row) => ({
        database,
        schema,
        name: String(row.function_name),
        parameters: String(row.parameters ?? ""),
      }));
    },
    async listFunctions(search) {
      const sql = search
        ? `SELECT function_name, function_type, parameters, return_type, description FROM duckdb_functions() WHERE function_name ILIKE ? ORDER BY function_name LIMIT 500`
        : `SELECT function_name, function_type, parameters, return_type, description FROM duckdb_functions() ORDER BY function_name LIMIT 500`;
      const values = search ? [`%${search}%`] : [];
      const result = await read(sql, values);
      return result.rows.map((row) => ({
        name: String(row.function_name),
        type: String(row.function_type ?? ""),
        parameters: String(row.parameters ?? ""),
        returnType: String(row.return_type ?? ""),
        description: String(row.description ?? ""),
      }));
    },
    async listTypes() {
      const result = await read(
        `SELECT type_name, logical_type, type_size FROM duckdb_types() ORDER BY type_name LIMIT 500`,
      );
      return result.rows.map((row) => ({
        name: String(row.type_name),
        logicalType: String(row.logical_type ?? ""),
        size: String(row.type_size ?? ""),
      }));
    },
    async listExtensions() {
      const result = await read(
        `SELECT extension_name, loaded, installed, extension_version, description FROM duckdb_extensions() ORDER BY extension_name`,
      );
      return result.rows.map((row) => ({
        name: String(row.extension_name),
        loaded: Boolean(row.loaded),
        installed: Boolean(row.installed),
        version: String(row.extension_version ?? ""),
        description: String(row.description ?? ""),
      }));
    },
    async installExtension(name, repository) {
      const target = repository ? `FROM '${escapeString(repository)}'` : "";
      await run(`INSTALL ${quote(name)}${target}`);
    },
    async loadExtension(name) {
      await run(`LOAD ${quote(name)}`);
    },
    async listSettings(search) {
      const sql = search
        ? `SELECT name, value, description, input_type FROM duckdb_settings() WHERE name ILIKE ? ORDER BY name LIMIT 500`
        : `SELECT name, value, description, input_type FROM duckdb_settings() ORDER BY name LIMIT 500`;
      const values = search ? [`%${search}%`] : [];
      const result = await read(sql, values);
      return result.rows.map((row) => ({
        name: String(row.name),
        value:
          row.value === null || row.value === undefined
            ? ""
            : String(row.value),
        description: String(row.description ?? ""),
        inputType: String(row.input_type ?? ""),
      }));
    },
    async setSetting(name, value) {
      await run(`SET ${quote(name)} = '${escapeString(value)}'`);
    },
    async resetSetting(name) {
      await run(`RESET ${quote(name)}`);
    },
    async listSecrets() {
      const result = await read(
        `SELECT name, type, provider, scope FROM duckdb_secrets() ORDER BY name`,
      );
      return result.rows.map((row) => ({
        name: String(row.name),
        type: String(row.type ?? ""),
        provider: String(row.provider ?? ""),
        scope: String(row.scope ?? ""),
      }));
    },
    async createSecret(input) {
      const parts = [`TYPE ${input.type}`];
      if (input.keyId) parts.push(`KEY_ID '${escapeString(input.keyId)}'`);
      parts.push(`SECRET '${escapeString(input.secret)}'`);
      if (input.region) parts.push(`REGION '${escapeString(input.region)}'`);
      if (input.endpoint)
        parts.push(`ENDPOINT '${escapeString(input.endpoint)}'`);
      if (input.scope) parts.push(`SCOPE '${escapeString(input.scope)}'`);
      await run(`CREATE SECRET (${parts.join(" ")})`);
    },
    async dropSecret(name) {
      await run(`DROP SECRET ${quote(name)}`).catch((error) => {
        throw new Error(
          `DROP SECRET failed: ${error instanceof Error ? error.message : name}`,
        );
      });
    },
    async attach(input) {
      const readOnly = input.readOnly ? " (READ_ONLY)" : "";
      await run(
        `ATTACH '${escapeString(input.source)}' AS ${quote(input.alias)}${readOnly}`,
      );
    },
    async detach(database) {
      await run(`DETACH ${quote(database)}`);
    },
    async serveQuack(input) {
      const argumentsSql = ["?"];
      const values: string[] = [input.uri ?? "quack:localhost"];
      if (input.token) {
        argumentsSql.push("token := ?");
        values.push(input.token);
      }
      if (input.allowRemote) argumentsSql.push("allow_other_hostname := true");
      return read(`CALL quack_serve(${argumentsSql.join(", ")})`, values);
    },
    async stopQuack(uri) {
      await run(`CALL quack_stop('${escapeString(uri)}')`);
    },
    async listQueryHistory(filter) {
      return history.filter(
        (entry) =>
          (!filter?.status || entry.status === filter.status) &&
          (!filter?.search || entry.sql.includes(filter.search)),
      );
    },
    async execute(sql, options) {
      if (options?.signal?.aborted) throw new Error("Query aborted");
      return record(sql, () => read(sql));
    },
    async version() {
      const result = await read(`SELECT version()`);
      return String(
        result.rows[0]?.["version()"] ?? result.rows[0]?.version ?? "",
      );
    },
  };
}

function quote(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function escapeString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "''");
}
