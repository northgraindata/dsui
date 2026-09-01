import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import postgres from "postgres";

const connectionSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().positive().default(5439),
  database: z.string().min(1).default("dev"),
  username: z.string().min(1),
  password: z.string().min(1),
  ssl: z.boolean().default(true),
});
const sqlInput = z.object({ sql: z.string().min(1).max(1_000_000) });
const MAX_ROWS = 2_000;

export const redshiftAdapter = defineAdapter({
  id: "redshift",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "redshift",
    name: "Amazon Redshift",
    category: "Data warehouse",
    description:
      "Browse Redshift metadata, workload activity, and execute SQL.",
    icon: "redshift",
    docsUrl: "https://docs.aws.amazon.com/redshift/",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "host",
      label: "Endpoint",
      type: "text",
      required: true,
      placeholder: "cluster.region.redshift.amazonaws.com",
    },
    {
      id: "port",
      label: "Port",
      type: "number",
      required: true,
      placeholder: "5439",
    },
    {
      id: "database",
      label: "Database",
      type: "text",
      required: true,
      placeholder: "dev",
    },
    { id: "username", label: "Username", type: "text", required: true },
    {
      id: "password",
      label: "Password",
      type: "password",
      required: true,
      secret: true,
    },
    { id: "ssl", label: "TLS", type: "boolean" },
  ],
  secretPaths: ["password"],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Cluster" },
    },
    {
      id: "query",
      authorization: "execute",
      supportsCancellation: true,
      view: { kind: "query", title: "Query", dialect: "redshift" },
    },
    {
      id: "schemas",
      authorization: "inspect",
      view: { kind: "schema-browser", title: "Schemas" },
    },
    {
      id: "tables",
      authorization: "inspect",
      view: { kind: "table-browser", title: "Tables" },
    },
    {
      id: "views",
      authorization: "inspect",
      view: { kind: "table-browser", title: "Views" },
    },
    {
      id: "queries",
      authorization: "inspect",
      view: { kind: "table-browser", title: "Query history" },
    },
    {
      id: "workload",
      authorization: "inspect",
      view: { kind: "table-browser", title: "Workload management" },
    },
    {
      id: "storage",
      authorization: "inspect",
      view: { kind: "service-info", title: "Storage" },
    },
    {
      id: "users",
      authorization: "inspect",
      view: { kind: "table-browser", title: "Users" },
    },
  ],
  create(_context, connection) {
    const client = postgres({
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password: connection.password,
      ssl: connection.ssl ? "require" : false,
      max: 2,
      connect_timeout: 10,
      idle_timeout: 20,
    });
    async function select(statement: string) {
      const rows = await client.unsafe(statement);
      return {
        items: Array.from(rows).slice(0, MAX_ROWS),
        columns: rows.columns?.map((column) => column.name),
        ...(rows.length > MAX_ROWS
          ? { warnings: [`Result truncated to ${MAX_ROWS} rows`] }
          : {}),
      };
    }
    return {
      async health() {
        const started = Date.now();
        try {
          await client`SELECT 1`;
          return {
            status: "healthy",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
          };
        } catch {
          return {
            status: "unavailable",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: "Unable to connect to Redshift",
          };
        }
      },
      async execute(operationId, input) {
        if (operationId === "query") return select(sqlInput.parse(input).sql);
        if (operationId === "service-info")
          return select(
            "SELECT version() AS version, current_database() AS database, current_user AS username",
          );
        if (operationId === "schemas")
          return select(
            "SELECT schema_name AS schema, schema_owner AS owner FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' ORDER BY 1",
          );
        if (operationId === "tables")
          return select(
            "SELECT schemaname AS schema, tablename AS name, tableowner AS owner, diststyle, sortkey1 AS sort_key, size AS size_mb, tbl_rows AS rows FROM svv_table_info ORDER BY 1,2",
          );
        if (operationId === "views")
          return select(
            "SELECT schemaname AS schema, viewname AS name, viewowner AS owner FROM pg_views WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2",
          );
        if (operationId === "queries")
          return select(
            "SELECT query_id, user_name, status, start_time, end_time, elapsed_time, queue_time, execution_time, left(query_text,1000) AS query FROM sys_query_history ORDER BY start_time DESC LIMIT 500",
          );
        if (operationId === "workload")
          return select(
            "SELECT service_class, num_query_tasks, num_executing_queries, num_queued_queries, query_working_mem FROM stv_wlm_service_class_state WHERE service_class > 4 ORDER BY service_class",
          );
        if (operationId === "storage")
          return select(
            'SELECT schema, "table", size AS size_mb, tbl_rows AS rows, unsorted, stats_off FROM svv_table_info ORDER BY size DESC LIMIT 500',
          );
        if (operationId === "users")
          return select(
            "SELECT usename AS username, usesysid AS id, usecreatedb AS create_database, usesuper AS superuser FROM pg_user ORDER BY 1",
          );
        throw new Error(`Unsupported Redshift operation: ${operationId}`);
      },
      close: () => client.end({ timeout: 2 }),
    };
  },
});

export default redshiftAdapter;
