import snowflake from "snowflake-sdk";
import type { SnowflakeConfig } from "./context.js";
import { explainSnowflakeError } from "./errors.js";
import { createUsageQueries, type UsageQueries } from "./usage.js";

// The adapter host reserves stdout for JSON-RPC; the driver logs there by default.
snowflake.configure({ logLevel: "OFF" });

const MAX_RESULT_BYTES = 16 * 1024 * 1024;

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface QueryHistoryEntry {
  queryId: string;
  text: string;
  user: string | null;
  warehouse: string | null;
  status: string;
  startedAt: string | null;
  elapsed: string;
  bytesScanned: number | null;
  rowsProduced: number | null;
  errorMessage: string | null;
  /** 1 while Snowflake can still cancel the statement; the Table `when` clause compares numbers. */
  canCancel: 0 | 1;
}

export interface Database {
  name: string;
  owner: string | null;
  createdOn: string | null;
}

export interface Warehouse {
  name: string;
  size: string | null;
  state: string | null;
  autoSuspend: number | null;
  autoResume: boolean | null;
  running: number | null;
  queued: number | null;
  minClusters: number | null;
  maxClusters: number | null;
  owner: string | null;
}

export const WAREHOUSE_SIZES = [
  "X-Small",
  "Small",
  "Medium",
  "Large",
  "X-Large",
  "2X-Large",
  "3X-Large",
  "4X-Large",
  "5X-Large",
  "6X-Large",
] as const;
export type WarehouseSize = (typeof WAREHOUSE_SIZES)[number];

export type WarehouseChange =
  | { kind: "suspend" }
  | { kind: "resume" }
  | { kind: "resize"; size: WarehouseSize }
  | { kind: "auto-suspend"; seconds: number };

export interface WarehouseLoadSample {
  time: number;
  running: number;
  queued: number;
}

export interface Schema {
  database: string;
  name: string;
  owner: string | null;
}

export interface Relation {
  database: string;
  schema: string;
  name: string;
  kind: string;
  rowCount: number | null;
}

export interface Column {
  name: string;
  position: number;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
}

export interface AccountUsageAccess {
  available: boolean;
  reason: string | null;
}

export interface RelationDetails {
  kind: string;
  owner: string | null;
  rowCount: number | null;
  bytes: number | null;
  clusteringKey: string | null;
  retentionDays: number | null;
  createdOn: string | null;
  lastAltered: string | null;
  comment: string | null;
}

export interface SnowflakeClient extends UsageQueries {
  serverInfo(): Promise<Record<string, unknown>>;
  relationDetails(
    database: string,
    schema: string,
    relation: string,
  ): Promise<RelationDetails | undefined>;
  relationDdl(
    database: string,
    schema: string,
    relation: string,
  ): Promise<string>;
  getWarehouse(name: string): Promise<Warehouse | undefined>;
  alterWarehouse(name: string, change: WarehouseChange): Promise<void>;
  /** Average running and queued queries per 5-minute interval, last 24 hours. */
  warehouseLoad(name: string): Promise<WarehouseLoadSample[]>;
  listQueryHistory(limit: number): Promise<QueryHistoryEntry[]>;
  getQuery(queryId: string): Promise<QueryHistoryEntry | undefined>;
  cancelQuery(queryId: string): Promise<void>;
  /** Whether the role can read SNOWFLAKE.ACCOUNT_USAGE (needs IMPORTED PRIVILEGES). */
  accountUsageAccess(): Promise<AccountUsageAccess>;
  listDatabases(): Promise<Database[]>;
  listWarehouses(): Promise<Warehouse[]>;
  listSchemas(database: string): Promise<Schema[]>;
  listRelations(database: string, schema: string): Promise<Relation[]>;
  listColumns(
    database: string,
    schema: string,
    relation: string,
  ): Promise<Column[]>;
  preview(
    database: string,
    schema: string,
    relation: string,
    maxRows: number,
  ): Promise<Record<string, unknown>[]>;
  execute(
    sql: string,
    maxRows: number,
    signal?: AbortSignal,
  ): Promise<QueryResult>;
  selectWarehouse(warehouse: string): Promise<void>;
  dispose(): Promise<void>;
}

const CANCELABLE_STATUSES = new Set([
  "RUNNING",
  "QUEUED",
  "RESUMING_WAREHOUSE",
  "BLOCKED",
]);

function formatElapsed(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "";
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1_000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function toQueryEntry(row: Record<string, unknown>): QueryHistoryEntry {
  const status = String(row.status);
  const elapsedMs = row.elapsedMs == null ? null : Number(row.elapsedMs);
  const text = (value: unknown) => (value == null ? null : String(value));
  const count = (value: unknown) => (value == null ? null : Number(value));
  return {
    queryId: String(row.queryId),
    text: String(row.text ?? ""),
    user: text(row.user),
    warehouse: text(row.warehouse),
    status,
    startedAt: text(row.startedAt),
    elapsed: formatElapsed(elapsedMs),
    bytesScanned: count(row.bytesScanned),
    rowsProduced: count(row.rowsProduced),
    errorMessage: text(row.errorMessage),
    canCancel: CANCELABLE_STATUSES.has(status) ? 1 : 0,
  };
}

function toWarehouse(row: Record<string, unknown>): Warehouse {
  const text = (value: unknown) => (value == null ? null : String(value));
  const count = (value: unknown) => (value == null ? null : Number(value));
  return {
    name: String(row.name),
    size: text(row.size),
    state: text(row.state),
    autoSuspend: count(row.auto_suspend),
    autoResume:
      row.auto_resume == null ? null : String(row.auto_resume) === "true",
    running: count(row.running),
    queued: count(row.queued),
    minClusters: count(row.min_cluster_count),
    maxClusters: count(row.max_cluster_count),
    owner: text(row.owner),
  };
}

/** Only validated enum values and integers reach the SQL text. */
export function warehouseChangeSql(change: WarehouseChange): string {
  switch (change.kind) {
    case "suspend":
      return "SUSPEND";
    case "resume":
      return "RESUME IF SUSPENDED";
    case "resize":
      if (!WAREHOUSE_SIZES.includes(change.size))
        throw new Error(`Unknown warehouse size: ${change.size}`);
      return `SET WAREHOUSE_SIZE = '${change.size}'`;
    case "auto-suspend":
      if (!Number.isInteger(change.seconds) || change.seconds < 0)
        throw new Error("Auto suspend must be a non-negative whole number.");
      return `SET AUTO_SUSPEND = ${change.seconds}`;
  }
}

const QUERY_HISTORY_COLUMNS = `QUERY_ID AS "queryId", QUERY_TEXT AS "text", USER_NAME AS "user", WAREHOUSE_NAME AS "warehouse", EXECUTION_STATUS AS "status", START_TIME AS "startedAt", TOTAL_ELAPSED_TIME AS "elapsedMs", BYTES_SCANNED AS "bytesScanned", ROWS_PRODUCED AS "rowsProduced", ERROR_MESSAGE AS "errorMessage"`;

/** Quote a Snowflake identifier without changing its case or interpreting dots. */
export function quoteIdentifier(value: string): string {
  if (!value) throw new Error("Identifier cannot be empty");
  return `"${value.replaceAll('"', '""')}"`;
}

function serializable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map(serializable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializable(item)]),
    );
  }
  return value;
}

function asRow(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("Snowflake returned an invalid row");
  }
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, serializable(value)]),
  );
}

export function snowflakeConnectionOptions(config: SnowflakeConfig) {
  return {
    account: config.account,
    ...(config.warehouse ? { warehouse: config.warehouse } : {}),
    database: config.database,
    schema: config.schema,
    role: config.role,
    application: config.application,
    sessionParameters: {
      STATEMENT_TIMEOUT_IN_SECONDS: config.statementTimeoutSeconds,
    },
    ...("username" in config ? { username: config.username } : {}),
    ...(config.method === "jwt"
      ? {
          authenticator: "SNOWFLAKE_JWT" as const,
          privateKeyPath: config.privateKeyPath,
          ...(config.privateKeyPass
            ? { privateKeyPass: config.privateKeyPass }
            : {}),
        }
      : {
          authenticator: "SNOWFLAKE" as const,
          password: config.password,
          ...(config.passcode ? { passcode: config.passcode } : {}),
        }),
  };
}

export async function createSnowflakeClient(
  config: SnowflakeConfig,
): Promise<SnowflakeClient> {
  const connection = snowflake.createConnection(
    snowflakeConnectionOptions(config),
  );

  await new Promise<void>((resolve, reject) => {
    connection.connect((error) => (error ? reject(error) : resolve()));
  });

  async function execute(
    sql: string,
    maxRows: number,
    signal?: AbortSignal,
    binds?: readonly (string | number | boolean | null)[],
  ): Promise<QueryResult> {
    signal?.throwIfAborted();
    return new Promise<QueryResult>((resolve, reject) => {
      let settled = false;
      let statement: ReturnType<typeof connection.execute> | undefined;
      const onAbort = () => {
        statement?.cancel();
        finish(signal?.reason ?? new Error("Query canceled"));
      };
      const finish = (error?: unknown, result?: QueryResult) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", onAbort);
        if (error) reject(error);
        else if (result) resolve(result);
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        statement = connection.execute({
          sqlText: sql,
          binds,
          streamResult: true,
          rowMode: "object_with_renamed_duplicated_columns",
          complete: (error, completed) => {
            if (error) return finish(error);
            if (!completed)
              return finish(new Error("Snowflake returned no statement"));
            if (signal?.aborted)
              return finish(signal.reason ?? new Error("Query canceled"));
            const rows: Record<string, unknown>[] = [];
            let bytes = 0;
            const stream = completed.streamRows({ start: 0, end: maxRows - 1 });
            stream.on("data", (row: unknown) => {
              try {
                const value = asRow(row);
                bytes += Buffer.byteLength(JSON.stringify(value));
                if (bytes > MAX_RESULT_BYTES) {
                  stream.destroy(new Error("Query result exceeds 16 MiB"));
                  return;
                }
                rows.push(value);
              } catch (streamError) {
                stream.destroy(
                  streamError instanceof Error
                    ? streamError
                    : new Error(String(streamError)),
                );
              }
            });
            stream.on("error", finish);
            stream.on("end", () =>
              finish(undefined, {
                columns:
                  completed.getColumns()?.map((column) => column.getName()) ??
                  [],
                rows,
                rowCount: rows.length,
              }),
            );
          },
        });
        if (signal?.aborted) onAbort();
      } catch (error) {
        finish(error);
      }
    });
  }

  async function rows(
    sql: string,
    maxRows = 10_000,
    binds?: readonly (string | number | boolean | null)[],
  ) {
    return (await execute(sql, maxRows, undefined, binds)).rows;
  }

  const relationDetails: SnowflakeClient["relationDetails"] = async (
    database,
    schema,
    relation,
  ) => {
    const [row] = await rows(
      `SELECT TABLE_TYPE AS "kind", TABLE_OWNER AS "owner", ROW_COUNT AS "rowCount", BYTES AS "bytes", CLUSTERING_KEY AS "clusteringKey", RETENTION_TIME AS "retentionDays", CREATED AS "createdOn", LAST_ALTERED AS "lastAltered", COMMENT AS "comment" FROM ${quoteIdentifier(database)}.INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      1,
      [schema, relation],
    );
    if (!row) return undefined;
    const text = (value: unknown) => (value == null ? null : String(value));
    const count = (value: unknown) => (value == null ? null : Number(value));
    return {
      kind: String(row.kind),
      owner: text(row.owner),
      rowCount: count(row.rowCount),
      bytes: count(row.bytes),
      clusteringKey: text(row.clusteringKey),
      retentionDays: count(row.retentionDays),
      createdOn: text(row.createdOn),
      lastAltered: text(row.lastAltered),
      comment: text(row.comment),
    };
  };

  const listWarehouses = async () =>
    (await rows("SHOW WAREHOUSES")).map(toWarehouse);

  return {
    async serverInfo() {
      const [row] = await rows(
        `SELECT CURRENT_ACCOUNT() AS "account", CURRENT_USER() AS "user", CURRENT_ROLE() AS "role", CURRENT_WAREHOUSE() AS "warehouse", CURRENT_DATABASE() AS "database", CURRENT_VERSION() AS "version"`,
        1,
      );
      if (!row) throw new Error("Snowflake did not return server information");
      return row;
    },
    async listQueryHistory(limit) {
      const resultLimit = Math.min(Math.max(Math.trunc(limit), 1), 10_000);
      return (
        await rows(
          `SELECT ${QUERY_HISTORY_COLUMNS} FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(RESULT_LIMIT => ${resultLimit})) ORDER BY START_TIME DESC`,
          resultLimit,
        )
      ).map(toQueryEntry);
    },
    async getQuery(queryId) {
      const [row] = await rows(
        `SELECT ${QUERY_HISTORY_COLUMNS} FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(RESULT_LIMIT => 10000)) WHERE QUERY_ID = ?`,
        1,
        [queryId],
      );
      return row ? toQueryEntry(row) : undefined;
    },
    async cancelQuery(queryId) {
      await rows("SELECT SYSTEM$CANCEL_QUERY(?)", 1, [queryId]);
    },
    async accountUsageAccess() {
      try {
        await rows(
          "SELECT 1 FROM SNOWFLAKE.ACCOUNT_USAGE.DATABASES LIMIT 1",
          1,
        );
        return { available: true, reason: null };
      } catch (error) {
        return { available: false, reason: explainSnowflakeError(error) };
      }
    },
    async listDatabases() {
      return (await rows("SHOW DATABASES")).map((row) => ({
        name: String(row.name),
        owner: row.owner ? String(row.owner) : null,
        createdOn: row.created_on ? String(row.created_on) : null,
      }));
    },
    listWarehouses,
    async getWarehouse(name) {
      return (await listWarehouses()).find((item) => item.name === name);
    },
    async alterWarehouse(name, change) {
      await execute(
        `ALTER WAREHOUSE ${quoteIdentifier(name)} ${warehouseChangeSql(change)}`,
        1,
      );
    },
    async warehouseLoad(name) {
      return (
        await rows(
          `SELECT START_TIME AS "time", AVG_RUNNING AS "running", AVG_QUEUED_LOAD AS "queued" FROM TABLE(INFORMATION_SCHEMA.WAREHOUSE_LOAD_HISTORY(DATE_RANGE_START => DATEADD('hour', -24, CURRENT_TIMESTAMP()), WAREHOUSE_NAME => ?)) ORDER BY START_TIME`,
          10_000,
          [name],
        )
      ).map((row) => ({
        time: new Date(String(row.time)).getTime(),
        running: Number(row.running ?? 0),
        queued: Number(row.queued ?? 0),
      }));
    },
    async selectWarehouse(warehouse) {
      await execute(`USE WAREHOUSE ${quoteIdentifier(warehouse)}`, 1);
    },
    async listSchemas(database) {
      return (
        await rows(
          `SELECT CATALOG_NAME AS "database", SCHEMA_NAME AS "name", SCHEMA_OWNER AS "owner" FROM ${quoteIdentifier(database)}.INFORMATION_SCHEMA.SCHEMATA ORDER BY SCHEMA_NAME`,
        )
      ).map((row) => ({
        database: String(row.database),
        name: String(row.name),
        owner: row.owner ? String(row.owner) : null,
      }));
    },
    async listRelations(database, schema) {
      const catalog = `${quoteIdentifier(database)}.INFORMATION_SCHEMA`;
      return (
        await rows(
          `SELECT TABLE_CATALOG AS "database", TABLE_SCHEMA AS "schema", TABLE_NAME AS "name", TABLE_TYPE AS "kind", ROW_COUNT AS "rowCount" FROM ${catalog}.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
          10_000,
          [schema],
        )
      ).map((row) => ({
        database: String(row.database),
        schema: String(row.schema),
        name: String(row.name),
        kind: String(row.kind),
        rowCount: typeof row.rowCount === "number" ? row.rowCount : null,
      }));
    },
    async listColumns(database, schema, relation) {
      return (
        await rows(
          `SELECT COLUMN_NAME AS "name", ORDINAL_POSITION AS "position", DATA_TYPE AS "type", IS_NULLABLE AS "nullable", COLUMN_DEFAULT AS "defaultValue" FROM ${quoteIdentifier(database)}.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
          10_000,
          [schema, relation],
        )
      ).map((row) => ({
        name: String(row.name),
        position: Number(row.position),
        type: String(row.type),
        nullable: row.nullable === "YES",
        defaultValue:
          row.defaultValue == null ? null : String(row.defaultValue),
      }));
    },
    relationDetails,
    async relationDdl(database, schema, relation) {
      const details = await relationDetails(database, schema, relation);
      if (!details) throw new Error(`${schema}.${relation} was not found.`);
      const name = [database, schema, relation].map(quoteIdentifier).join(".");
      const objectType = details.kind === "VIEW" ? "VIEW" : "TABLE";
      const [row] = await rows(`SELECT GET_DDL(?, ?, TRUE) AS "ddl"`, 1, [
        objectType,
        name,
      ]);
      return String(row?.ddl ?? "");
    },
    ...createUsageQueries(rows),
    async preview(database, schema, relation, maxRows) {
      const name = [database, schema, relation].map(quoteIdentifier).join(".");
      return (await execute(`SELECT * FROM ${name} LIMIT ${maxRows}`, maxRows))
        .rows;
    },
    execute,
    async dispose() {
      await new Promise<void>((resolve, reject) => {
        connection.destroy((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
