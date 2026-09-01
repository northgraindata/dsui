import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import postgres from "postgres";

const connectionSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().positive().default(5432),
  database: z.string().min(1).default("postgres"),
  username: z.string().min(1).default("postgres"),
  password: z.string().optional(),
  ssl: z.boolean().default(false),
  applicationName: z.string().default("dsui"),
});

const sqlInput = z.object({ sql: z.string().min(1).max(1_000_000) });
const MAX_ROWS = 2_000;

export const postgresAdapter = defineAdapter({
  id: "postgres",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "postgres",
    name: "PostgreSQL",
    category: "Database",
    description: "Browse PostgreSQL metadata, activity, and execute SQL.",
    icon: "postgres",
    docsUrl: "https://www.postgresql.org/docs/current/",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "host",
      label: "Host",
      type: "text",
      required: true,
      placeholder: "postgres",
    },
    {
      id: "port",
      label: "Port",
      type: "number",
      required: true,
      placeholder: "5432",
    },
    {
      id: "database",
      label: "Database",
      type: "text",
      required: true,
      placeholder: "postgres",
    },
    {
      id: "username",
      label: "Username",
      type: "text",
      required: true,
      placeholder: "postgres",
    },
    { id: "password", label: "Password", type: "password", secret: true },
    { id: "ssl", label: "TLS", type: "boolean" },
  ],
  secretPaths: ["password"],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Server" },
    },
    {
      id: "query",
      authorization: "execute",
      supportsCancellation: true,
      view: { kind: "query", title: "Query", dialect: "postgresql" },
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
      id: "functions",
      authorization: "inspect",
      view: { kind: "table-browser", title: "Functions" },
    },
    {
      id: "active-queries",
      authorization: "inspect",
      view: { kind: "table-browser", title: "Activity" },
    },
    {
      id: "locks",
      authorization: "inspect",
      view: { kind: "table-browser", title: "Locks" },
    },
    {
      id: "database-sizes",
      authorization: "inspect",
      view: { kind: "service-info", title: "Database sizes" },
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
      connection: { application_name: connection.applicationName },
      max: 2,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    async function select(statement: string) {
      const rows = await client.unsafe(statement);
      const items = Array.from(rows).slice(0, MAX_ROWS);
      return {
        items,
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
            detail: "Unable to connect to PostgreSQL",
          };
        }
      },
      async execute(operationId, input) {
        if (operationId === "query") return select(sqlInput.parse(input).sql);
        if (operationId === "service-info")
          return select(
            "SELECT version() AS version, current_database() AS database, current_user AS username, inet_server_addr()::text AS server_address, inet_server_port() AS server_port",
          );
        if (operationId === "schemas")
          return select(
            "SELECT schema_name AS schema, schema_owner AS owner FROM information_schema.schemata ORDER BY schema_name",
          );
        if (operationId === "tables")
          return select(
            "SELECT schemaname AS schema, tablename AS name, tableowner AS owner, pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, tablename)::regclass)) AS total_size FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2",
          );
        if (operationId === "views")
          return select(
            "SELECT table_schema AS schema, table_name AS name, is_updatable FROM information_schema.views WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1,2",
          );
        if (operationId === "functions")
          return select(
            "SELECT n.nspname AS schema, p.proname AS name, pg_get_function_result(p.oid) AS result_type, pg_get_function_arguments(p.oid) AS arguments FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2",
          );
        if (operationId === "active-queries")
          return select(
            "SELECT pid, usename AS username, datname AS database, state, wait_event_type, wait_event, query_start, left(query, 1000) AS query FROM pg_stat_activity WHERE pid <> pg_backend_pid() ORDER BY query_start DESC NULLS LAST",
          );
        if (operationId === "locks")
          return select(
            "SELECT l.pid, l.locktype, l.mode, l.granted, l.relation::regclass::text AS relation, a.usename AS username, left(a.query, 500) AS query FROM pg_locks l LEFT JOIN pg_stat_activity a ON a.pid=l.pid ORDER BY l.granted, l.pid",
          );
        if (operationId === "database-sizes")
          return select(
            "SELECT datname AS database, pg_size_pretty(pg_database_size(datname)) AS size, numbackends AS connections, xact_commit AS commits, xact_rollback AS rollbacks FROM pg_stat_database WHERE datname IS NOT NULL ORDER BY pg_database_size(datname) DESC",
          );
        throw new Error(`Unsupported PostgreSQL operation: ${operationId}`);
      },
      close: () => client.end({ timeout: 2 }),
    };
  },
});

export default postgresAdapter;
