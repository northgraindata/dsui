import snowflake from "snowflake-sdk";
import type { SnowflakeConfig } from "./context.js";

// The adapter host reserves stdout for JSON-RPC; the driver logs there by default.
snowflake.configure({ logLevel: "OFF" });

const MAX_RESULT_BYTES = 16 * 1024 * 1024;

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
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

export interface SnowflakeClient {
  serverInfo(): Promise<Record<string, unknown>>;
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

  return {
    async serverInfo() {
      const [row] = await rows(
        `SELECT CURRENT_ACCOUNT() AS "account", CURRENT_USER() AS "user", CURRENT_ROLE() AS "role", CURRENT_WAREHOUSE() AS "warehouse", CURRENT_DATABASE() AS "database", CURRENT_VERSION() AS "version"`,
        1,
      );
      if (!row) throw new Error("Snowflake did not return server information");
      return row;
    },
    async listDatabases() {
      return (await rows("SHOW DATABASES")).map((row) => ({
        name: String(row.name),
        owner: row.owner ? String(row.owner) : null,
        createdOn: row.created_on ? String(row.created_on) : null,
      }));
    },
    async listWarehouses() {
      return (await rows("SHOW WAREHOUSES")).map((row) => ({
        name: String(row.name),
        size: row.size == null ? null : String(row.size),
        state: row.state == null ? null : String(row.state),
        autoSuspend: row.auto_suspend == null ? null : Number(row.auto_suspend),
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
