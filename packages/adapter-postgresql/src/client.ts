import postgres from "postgres";
import type { PostgreSQLConfig } from "./context.js";

const MAX_RESULT_BYTES = 16 * 1024 * 1024;

export interface PostgreSQLServerInfo {
  currentDatabase: string;
  currentUser: string;
  serverVersion: string;
  serverVersionNumber: number;
}

export interface PostgreSQLDatabase {
  name: string;
  owner: string;
  encoding: string;
  allowConnections: boolean;
  sizeBytes: string;
}

export interface PostgreSQLSchema {
  name: string;
  owner: string;
}

export interface PostgreSQLRelation {
  schema: string;
  name: string;
  kind: "table" | "view" | "materialized-view" | "foreign-table" | "sequence";
  owner: string;
  estimatedRows: number;
}

export interface PostgreSQLColumn {
  name: string;
  position: number;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
}

export interface PostgreSQLQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface PostgreSQLActivityEntry {
  pid: number;
  database: string | null;
  user: string | null;
  state: string | null;
  query: string;
  queryStart: string | null;
  waitEventType: string | null;
  waitEvent: string | null;
  clientAddress: string | null;
}

export interface PostgreSQLIndex {
  name: string;
  columns: string[];
  method: string;
  isUnique: boolean;
  isPrimary: boolean;
  sizeBytes: string;
}

export interface PostgreSQLConstraint {
  name: string;
  type: "check" | "foreign-key" | "primary-key" | "unique" | "exclude";
  columns: string[];
  definition: string;
}

export interface PostgreSQLClient {
  serverInfo(): Promise<PostgreSQLServerInfo>;
  listDatabases(scope: "all" | "selected"): Promise<PostgreSQLDatabase[]>;
  listSchemas(): Promise<PostgreSQLSchema[]>;
  listRelations(schema: string): Promise<PostgreSQLRelation[]>;
  listColumns(schema: string, relation: string): Promise<PostgreSQLColumn[]>;
  listIndexes(schema: string, relation: string): Promise<PostgreSQLIndex[]>;
  listConstraints(
    schema: string,
    relation: string,
  ): Promise<PostgreSQLConstraint[]>;
  previewRelation(
    schema: string,
    relation: string,
    maxRows: number,
  ): Promise<PostgreSQLQueryResult>;
  listActivity(filters: {
    database?: string;
    state?: string;
  }): Promise<PostgreSQLActivityEntry[]>;
  execute(sql: string, maxRows: number): Promise<PostgreSQLQueryResult>;
  dispose(): Promise<void>;
}

export function createPostgreSQLClient(
  config: PostgreSQLConfig,
): PostgreSQLClient {
  const sql = postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    ssl: sslOption(config),
    connect_timeout: config.connectTimeout,
    max_lifetime: 60 * 60,
    connection: {
      application_name: config.applicationName,
      statement_timeout: config.statementTimeout,
    },
  });

  return {
    async serverInfo() {
      const [row] = await sql<PostgreSQLServerInfo[]>`
        select
          current_database() as "currentDatabase",
          current_user as "currentUser",
          version() as "serverVersion",
          current_setting('server_version_num')::integer as "serverVersionNumber"
      `;
      if (!row) throw new Error("PostgreSQL did not return server information");
      return row;
    },

    async listDatabases(scope) {
      return sql<PostgreSQLDatabase[]>`
        select
          datname as name,
          pg_get_userbyid(datdba) as owner,
          pg_encoding_to_char(encoding) as encoding,
          datallowconn as "allowConnections",
          pg_database_size(datname)::text as "sizeBytes"
        from pg_database
        where not datistemplate
          and (${scope === "all" ? null : config.database}::text is null
            or datname = ${scope === "all" ? null : config.database})
        order by datname
      `;
    },

    async listSchemas() {
      return sql<PostgreSQLSchema[]>`
        select schema_name as name, schema_owner as owner
        from information_schema.schemata
        where schema_name not in ('information_schema')
          and schema_name not like 'pg_%'
        order by schema_name
      `;
    },

    async listRelations(schema) {
      return sql<PostgreSQLRelation[]>`
        select
          n.nspname as schema,
          c.relname as name,
          case c.relkind
            when 'r' then 'table'
            when 'v' then 'view'
            when 'm' then 'materialized-view'
            when 'f' then 'foreign-table'
            when 'S' then 'sequence'
          end as kind,
          pg_get_userbyid(c.relowner) as owner,
          c.reltuples::double precision as "estimatedRows"
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = ${schema}
          and c.relkind in ('r', 'v', 'm', 'f', 'S')
        order by c.relname
      `;
    },

    async listColumns(schema, relation) {
      return sql<PostgreSQLColumn[]>`
        select
          a.attname as name,
          a.attnum::integer as position,
          format_type(a.atttypid, a.atttypmod) as type,
          not a.attnotnull as nullable,
          pg_get_expr(ad.adbin, ad.adrelid) as "defaultValue"
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        left join pg_attrdef ad
          on ad.adrelid = a.attrelid and ad.adnum = a.attnum
        where n.nspname = ${schema}
          and c.relname = ${relation}
          and a.attnum > 0
          and not a.attisdropped
        order by a.attnum
      `;
    },

    async listIndexes(schema, relation) {
      return sql<PostgreSQLIndex[]>`
        select
          index_class.relname as name,
          array_agg(attribute.attname order by key.ordinality) as columns,
          access_method.amname as method,
          index_info.indisunique as "isUnique",
          index_info.indisprimary as "isPrimary",
          pg_relation_size(index_class.oid)::text as "sizeBytes"
        from pg_index index_info
        join pg_class table_class on table_class.oid = index_info.indrelid
        join pg_namespace namespace on namespace.oid = table_class.relnamespace
        join pg_class index_class on index_class.oid = index_info.indexrelid
        join pg_am access_method on access_method.oid = index_class.relam
        cross join lateral unnest(index_info.indkey) with ordinality key(attnum, ordinality)
        join pg_attribute attribute
          on attribute.attrelid = table_class.oid and attribute.attnum = key.attnum
        where namespace.nspname = ${schema}
          and table_class.relname = ${relation}
        group by index_class.oid, index_class.relname, access_method.amname,
          index_info.indisunique, index_info.indisprimary
        order by index_class.relname
      `;
    },

    async listConstraints(schema, relation) {
      return sql<PostgreSQLConstraint[]>`
        select
          constraint_info.conname as name,
          case constraint_info.contype
            when 'c' then 'check'
            when 'f' then 'foreign-key'
            when 'p' then 'primary-key'
            when 'u' then 'unique'
            when 'x' then 'exclude'
          end as type,
          coalesce(array_agg(attribute.attname order by key.ordinality)
            filter (where attribute.attname is not null), '{}') as columns,
          pg_get_constraintdef(constraint_info.oid, true) as definition
        from pg_constraint constraint_info
        join pg_class table_class on table_class.oid = constraint_info.conrelid
        join pg_namespace namespace on namespace.oid = table_class.relnamespace
        left join lateral unnest(constraint_info.conkey) with ordinality key(attnum, ordinality)
          on true
        left join pg_attribute attribute
          on attribute.attrelid = table_class.oid and attribute.attnum = key.attnum
        where namespace.nspname = ${schema}
          and table_class.relname = ${relation}
        group by constraint_info.oid, constraint_info.conname,
          constraint_info.contype
        order by constraint_info.conname
      `;
    },

    async previewRelation(schema, relation, maxRows) {
      const result = await sql<Record<string, unknown>[]>`
        select * from ${sql(schema, relation)} limit ${maxRows}
      `;
      const columns = result.columns.map((column) => column.name);
      if (new Set(columns).size !== columns.length)
        throw new Error("Preview returned duplicate column names");
      const rows = result.map((row) =>
        Object.fromEntries(
          columns.map((column) => [column, toSerializableValue(row[column])]),
        ),
      );
      return { columns, rows, rowCount: rows.length };
    },

    async listActivity({ database, state }) {
      return sql<PostgreSQLActivityEntry[]>`
        select
          pid::integer,
          datname as database,
          usename as "user",
          state,
          query,
          query_start::text as "queryStart",
          wait_event_type as "waitEventType",
          wait_event as "waitEvent",
          client_addr::text as "clientAddress"
        from pg_stat_activity
        where pid <> pg_backend_pid()
          and (${database ?? null}::text is null or datname = ${database ?? null})
          and (${state ?? null}::text is null or state = ${state ?? null})
        order by query_start desc nulls last
        limit 100
      `;
    },

    async execute(query, maxRows) {
      const result = await sql.unsafe<Record<string, unknown>[]>(query);
      if (result.length > maxRows)
        throw new Error(
          `Query returned more than ${maxRows} rows; narrow the query or raise the limit`,
        );

      const columns = result.columns.map((column) => column.name);
      if (new Set(columns).size !== columns.length)
        throw new Error("Query returned duplicate column names; use aliases");
      const rows = result.map((row) =>
        Object.fromEntries(
          columns.map((column) => [column, toSerializableValue(row[column])]),
        ),
      );
      const resultBytes = Buffer.byteLength(JSON.stringify(rows));
      if (resultBytes > MAX_RESULT_BYTES)
        throw new Error("Query result exceeds the 16 MiB response limit");
      return { columns, rows, rowCount: rows.length };
    },

    async dispose() {
      await sql.end({ timeout: 5 });
    },
  };
}

function toSerializableValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  if (Array.isArray(value)) return value.map(toSerializableValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        toSerializableValue(nested),
      ]),
    );
  return value;
}

function sslOption(config: PostgreSQLConfig) {
  if (config.sslMode === "disable") return false;
  if (
    !config.sslRootCert &&
    !config.sslCert &&
    !config.sslKey &&
    config.sslMode !== "verify-ca"
  )
    return config.sslMode;

  return {
    rejectUnauthorized:
      config.sslMode === "verify-ca" || config.sslMode === "verify-full",
    ...(config.sslRootCert ? { ca: config.sslRootCert } : {}),
    ...(config.sslCert ? { cert: config.sslCert } : {}),
    ...(config.sslKey ? { key: config.sslKey } : {}),
  };
}
