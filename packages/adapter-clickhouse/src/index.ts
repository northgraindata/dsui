import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const connectionSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().positive().default(8123),
  protocol: z.enum(["http", "https"]).default("http"),
  username: z.string().min(1).default("default"),
  password: z.string().optional(),
  database: z.string().optional(),
});
type Connection = z.output<typeof connectionSchema>;

const ROW_CAP = 2000;
const base = (c: Connection) => `${c.protocol}://${c.host}:${c.port}`;

function authHeaders(c: Connection): HeadersInit {
  return c.password
    ? { Authorization: `Basic ${btoa(`${c.username}:${c.password}`)}` }
    : {};
}

/**
 * Appends a row cap and the JSON output format unless the caller already
 * provided a `FORMAT` or `SETTINGS` clause. The row cap makes ClickHouse
 * truncate large results itself (via `result_overflow_mode='break'`), which
 * we surface as a warning instead of buffering everything server-side.
 */
function cappedQuery(sql: string): string {
  const q = sql.trimEnd().replace(/;\s*$/, "");
  const hasFormat = /\bformat\s+\w+/i.test(q);
  const hasSettings = /\bsettings\s+/i.test(q);
  if (hasFormat || hasSettings) return q;
  return `${q} SETTINGS max_result_rows=${ROW_CAP}, result_overflow_mode='break' FORMAT JSON`;
}

export const clickhouseAdapter = defineAdapter({
  id: "clickhouse",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "clickhouse",
    name: "ClickHouse",
    category: "Query engine",
    description: "Browse metadata and execute ClickHouse SQL.",
    icon: "clickhouse",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "host",
      label: "Host",
      type: "text",
      required: true,
      placeholder: "clickhouse",
    },
    {
      id: "port",
      label: "Port",
      type: "number",
      required: true,
      placeholder: "8123",
    },
    {
      id: "username",
      label: "Username",
      type: "text",
      required: true,
      placeholder: "default",
    },
    { id: "password", label: "Password", type: "password", secret: true },
    { id: "database", label: "Default database", type: "text" },
  ],
  secretPaths: ["password"],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Service information" },
    },
    {
      id: "query",
      authorization: "execute",
      supportsCancellation: true,
      view: { kind: "query", title: "Query", dialect: "clickhouse" },
    },
    {
      id: "schemas",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "schema-browser",
        title: "Databases",
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "engine", label: "Engine", format: "text" },
        ],
      },
    },
    {
      id: "tables",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Tables",
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "name", label: "Table", format: "code" },
          { id: "engine", label: "Engine", format: "text" },
          { id: "total_rows", label: "Rows", format: "number" },
        ],
      },
    },
    {
      id: "columns",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Columns",
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "table", label: "Table", format: "code" },
          { id: "name", label: "Column", format: "code" },
          { id: "type", label: "Type", format: "code" },
        ],
      },
    },
    {
      id: "metrics",
      authorization: "inspect",
      view: { kind: "service-info", title: "Metrics" },
    },
    {
      id: "running-queries",
      authorization: "inspect",
      view: {
        kind: "table-browser",
        title: "Running queries",
        columns: [
          { id: "query_id", label: "Query ID", format: "code" },
          { id: "user", label: "User", format: "text" },
          { id: "elapsed", label: "Elapsed (s)", format: "number" },
          { id: "query", label: "Query", format: "code" },
        ],
      },
    },
    {
      id: "recent-queries",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Recent queries",
        columns: [
          { id: "query_id", label: "Query ID", format: "code" },
          { id: "user", label: "User", format: "text" },
          { id: "query_duration_ms", label: "Duration (ms)", format: "number" },
          { id: "read_rows", label: "Read rows", format: "number" },
          { id: "memory_usage", label: "Memory (B)", format: "number" },
          { id: "query", label: "Query", format: "code" },
        ],
      },
    },
    {
      id: "replication",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Replicas",
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "table", label: "Table", format: "code" },
          { id: "is_readonly", label: "Read-only", format: "status" },
          { id: "absolute_delay", label: "Delay (s)", format: "number" },
          { id: "queue_size", label: "Queue", format: "number" },
          { id: "active_replicas", label: "Active", format: "number" },
        ],
      },
    },
    {
      id: "merges",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Merges",
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "table", label: "Table", format: "code" },
          { id: "elapsed", label: "Elapsed (s)", format: "number" },
          { id: "progress", label: "Progress", format: "number" },
          { id: "num_rows", label: "Rows", format: "number" },
          { id: "num_bytes", label: "Bytes", format: "number" },
        ],
      },
    },
    {
      id: "mutations",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Mutations",
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "table", label: "Table", format: "code" },
          { id: "command", label: "Command", format: "code" },
          { id: "create_time", label: "Created", format: "timestamp" },
          { id: "is_done", label: "Done", format: "status" },
          { id: "parts_to_do", label: "Parts left", format: "number" },
        ],
      },
    },
    {
      id: "parts",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Table sizes",
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "table", label: "Table", format: "code" },
          { id: "parts", label: "Parts", format: "number" },
          { id: "rows", label: "Rows", format: "number" },
          { id: "bytes", label: "Bytes", format: "bytes" },
        ],
      },
    },
    {
      id: "clusters",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Cluster topology",
        columns: [
          { id: "cluster", label: "Cluster", format: "code" },
          { id: "shard_num", label: "Shard", format: "number" },
          { id: "replica_num", label: "Replica", format: "number" },
          { id: "host_name", label: "Host", format: "code" },
          { id: "port", label: "Port", format: "number" },
        ],
      },
    },
  ],
  create(context, connection) {
    const request = context.fetch ?? fetch;
    type Page = {
      rows: unknown[][];
      columns: string[];
      error?: { message?: string };
      truncated: boolean;
    };
    async function runStatement(sql: string): Promise<Page> {
      const url = new URL(`${base(connection)}/`);
      if (connection.database)
        url.searchParams.set("database", connection.database);
      const response = await request(url, {
        method: "POST",
        headers: { ...authHeaders(connection), "Content-Type": "text/plain" },
        body: cappedQuery(sql),
        signal: context.signal,
      });
      if (!response.ok) {
        const detail = (await response.text().catch(() => "")) ?? "";
        throw new Error(
          `ClickHouse request failed (${response.status}): ${detail.slice(0, 500)}`,
        );
      }
      const json = (await response.json()) as {
        meta?: { name: string; type?: string }[];
        data?: Record<string, unknown>[];
        rows_before_limit_at_least?: number;
      };
      const columns = (json.meta ?? []).map((c) => c.name);
      const rows = (json.data ?? []).map((obj) => columns.map((c) => obj[c]));
      const truncated =
        (json.rows_before_limit_at_least ?? rows.length) > rows.length;
      return { rows, columns, truncated };
    }
    async function select(sql: string) {
      const page = await runStatement(sql);
      return { items: page.rows, columns: page.columns };
    }
    function count(page: Page): number {
      const value = page.rows[0]?.[0];
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    return {
      async health() {
        const started = Date.now();
        try {
          await runStatement("SELECT 1");
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
            detail: "Unable to reach ClickHouse",
          };
        }
      },
      async execute(operationId, input) {
        if (operationId === "query") {
          const sql = z.object({ sql: z.string().min(1) }).parse(input).sql;
          const page = await runStatement(sql);
          return {
            items: page.rows,
            columns: page.columns,
            ...(page.truncated
              ? { warnings: [`Result truncated to ${page.rows.length} rows`] }
              : {}),
          };
        }
        if (operationId === "schemas")
          return select(
            "SELECT name AS database, engine FROM system.databases ORDER BY name",
          );
        if (operationId === "tables")
          return select(
            "SELECT database, name, engine, total_rows FROM system.tables ORDER BY database, name",
          );
        if (operationId === "columns")
          return select(
            "SELECT database, table, name, type FROM system.columns ORDER BY database, table, name",
          );
        if (operationId === "running-queries")
          return select(
            "SELECT query_id, user, elapsed, query FROM system.processes ORDER BY elapsed DESC",
          );
        if (operationId === "recent-queries")
          return select(
            "SELECT query_id, user, query_duration_ms, read_rows, memory_usage, query FROM system.query_log WHERE type = 'QueryFinish' ORDER BY event_time DESC LIMIT 200",
          );
        if (operationId === "replication")
          return select(
            "SELECT database, table, is_readonly, absolute_delay, queue_size, active_replicas FROM system.replicas ORDER BY database, table",
          );
        if (operationId === "merges")
          return select(
            "SELECT database, table, elapsed, progress, num_rows, num_bytes FROM system.merges ORDER BY elapsed DESC",
          );
        if (operationId === "mutations")
          return select(
            "SELECT database, table, command, create_time, is_done, parts_to_do FROM system.mutations ORDER BY create_time DESC",
          );
        if (operationId === "parts")
          return select(
            "SELECT database, table, count() AS parts, sum(rows) AS rows, sum(bytes_on_disk) AS bytes FROM system.parts WHERE active ORDER BY bytes DESC",
          );
        if (operationId === "clusters")
          return select(
            "SELECT cluster, shard_num, replica_num, host_name, port FROM system.clusters ORDER BY cluster, shard_num, replica_num",
          );
        if (operationId === "service-info") {
          const version = await runStatement("SELECT version()");
          return {
            items: [
              { label: "Endpoint", value: base(connection), format: "code" },
              {
                label: "Database",
                value: connection.database ?? "default",
                format: "code",
              },
              {
                label: "Version",
                value: String(version.rows[0]?.[0] ?? "unknown"),
                format: "text",
              },
            ],
            columns: ["label", "value", "format"],
          };
        }
        if (operationId === "metrics") {
          const [databases, tables, running, parts, merges, mutations] =
            await Promise.all([
              runStatement("SELECT count() FROM system.databases"),
              runStatement("SELECT count() FROM system.tables"),
              runStatement("SELECT count() FROM system.processes"),
              runStatement("SELECT count() FROM system.parts WHERE active"),
              runStatement("SELECT count() FROM system.merges"),
              runStatement(
                "SELECT count() FROM system.mutations WHERE NOT is_done",
              ),
            ]);
          return {
            items: [
              {
                label: "Databases",
                value: count(databases),
                format: "number",
              },
              { label: "Tables", value: count(tables), format: "number" },
              {
                label: "Running queries",
                value: count(running),
                format: "number",
              },
              { label: "Active parts", value: count(parts), format: "number" },
              { label: "Merges", value: count(merges), format: "number" },
              {
                label: "Mutations in flight",
                value: count(mutations),
                format: "number",
              },
            ],
            columns: ["label", "value", "format"],
          };
        }
        throw new Error(`Unsupported ClickHouse operation: ${operationId}`);
      },
    };
  },
});
export default clickhouseAdapter;
