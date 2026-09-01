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
const tableIdentitySchema = z.object({
  database: z.string().min(1),
  table: z.string().min(1),
});
const tablePageSchema = tableIdentitySchema.extend({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
const WORKSPACE_AREAS = {
  overview: { id: "overview", label: "Overview", order: 0 },
  explorer: { id: "explorer", label: "Explorer", order: 10 },
  query: { id: "query", label: "Query", order: 20 },
  operations: { id: "operations", label: "Operations", order: 30 },
  governance: { id: "governance", label: "Governance", order: 40 },
  administration: { id: "administration", label: "Administration", order: 50 },
} as const;
type WorkspaceArea = keyof typeof WORKSPACE_AREAS;
const navigation = (area: WorkspaceArea) => ({
  area: WORKSPACE_AREAS[area],
});
const childNavigation = (area: WorkspaceArea, parent: string) => ({
  ...navigation(area),
  parent: { capability: parent },
});
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
      id: "explorer",
      authorization: "inspect",
      view: {
        kind: "database-explorer",
        title: "Explorer",
        description: "Browse databases and inspect ClickHouse tables.",
        navigation: navigation("explorer"),
        databaseExplorer: {
          databasesCapability: "schemas",
          objectsCapability: "database-objects",
          databaseIdField: "database",
          objectNameField: "name",
          objectTypeField: "object_type",
          tabs: [
            {
              id: "overview",
              label: "Overview",
              capability: "table-overview",
              kind: "record-detail",
            },
            {
              id: "columns",
              label: "Columns",
              capability: "table-columns",
              kind: "record-list",
            },
            {
              id: "data",
              label: "Data",
              capability: "table-preview",
              kind: "record-list",
            },
            {
              id: "ddl",
              label: "DDL",
              capability: "table-ddl",
              kind: "code",
            },
            {
              id: "parts",
              label: "Parts",
              capability: "table-parts",
              kind: "record-list",
            },
          ],
        },
      },
    },
    {
      id: "database-objects",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "record-list",
        title: "Database objects",
        navigation: {
          ...navigation("explorer"),
          parent: { capability: "explorer" },
        },
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "name", label: "Name", format: "code" },
          { id: "object_type", label: "Type", format: "text" },
          { id: "engine", label: "Engine", format: "text" },
          { id: "total_rows", label: "Rows", format: "number" },
          { id: "total_bytes", label: "Bytes", format: "bytes" },
        ],
      },
    },
    {
      id: "table-overview",
      authorization: "inspect",
      view: {
        kind: "record-detail",
        title: "Table overview",
        navigation: {
          ...navigation("explorer"),
          parent: { capability: "explorer" },
        },
      },
    },
    {
      id: "table-columns",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "record-list",
        title: "Table columns",
        navigation: {
          ...navigation("explorer"),
          parent: { capability: "explorer" },
        },
        columns: [
          { id: "name", label: "Column", format: "code" },
          { id: "type", label: "Type", format: "code" },
          { id: "position", label: "Position", format: "number" },
          { id: "default_kind", label: "Default", format: "text" },
          { id: "default_expression", label: "Expression", format: "code" },
          { id: "compression_codec", label: "Codec", format: "code" },
          { id: "ttl_expression", label: "TTL", format: "code" },
          { id: "comment", label: "Comment", format: "text" },
        ],
      },
    },
    {
      id: "table-preview",
      authorization: "inspect",
      supportsPagination: true,
      maxPageSize: 1000,
      view: {
        kind: "record-list",
        title: "Table data",
        navigation: {
          ...navigation("explorer"),
          parent: { capability: "explorer" },
        },
      },
    },
    {
      id: "table-ddl",
      authorization: "inspect",
      view: {
        kind: "record-detail",
        title: "Table DDL",
        navigation: {
          ...navigation("explorer"),
          parent: { capability: "explorer" },
        },
      },
    },
    {
      id: "table-parts",
      authorization: "inspect",
      supportsPagination: true,
      maxPageSize: 1000,
      view: {
        kind: "record-list",
        title: "Table parts",
        navigation: {
          ...navigation("explorer"),
          parent: { capability: "explorer" },
        },
        columns: [
          { id: "partition", label: "Partition", format: "code" },
          { id: "name", label: "Part", format: "code" },
          { id: "rows", label: "Rows", format: "number" },
          { id: "bytes_on_disk", label: "Bytes", format: "bytes" },
          { id: "marks", label: "Marks", format: "number" },
          { id: "disk_name", label: "Disk", format: "code" },
          { id: "modification_time", label: "Modified", format: "timestamp" },
        ],
      },
    },
    {
      id: "service-info",
      authorization: "inspect",
      view: {
        kind: "service-info",
        title: "Service information",
        navigation: navigation("overview"),
      },
    },
    {
      id: "query",
      authorization: "execute",
      supportsCancellation: true,
      view: {
        kind: "query",
        title: "Query",
        dialect: "clickhouse",
        navigation: navigation("query"),
      },
    },
    {
      id: "schemas",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "schema-browser",
        title: "Databases",
        navigation: childNavigation("explorer", "explorer"),
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
        navigation: childNavigation("explorer", "explorer"),
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
        navigation: childNavigation("explorer", "explorer"),
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "table", label: "Table", format: "code" },
          { id: "name", label: "Column", format: "code" },
          { id: "type", label: "Type", format: "code" },
        ],
      },
    },
    {
      id: "views",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Views",
        navigation: childNavigation("explorer", "explorer"),
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "name", label: "View", format: "code" },
          { id: "engine", label: "Engine", format: "text" },
          { id: "as_select", label: "Query", format: "code" },
          { id: "comment", label: "Comment", format: "text" },
        ],
      },
    },
    {
      id: "materialized-views",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Materialized views",
        navigation: childNavigation("explorer", "explorer"),
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "name", label: "View", format: "code" },
          { id: "target_database", label: "Target database", format: "code" },
          { id: "target_table", label: "Target table", format: "code" },
          { id: "as_select", label: "Query", format: "code" },
          { id: "comment", label: "Comment", format: "text" },
        ],
      },
    },
    {
      id: "dictionaries",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Dictionaries",
        navigation: childNavigation("explorer", "explorer"),
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "name", label: "Dictionary", format: "code" },
          { id: "status", label: "Status", format: "status" },
          { id: "type", label: "Layout", format: "text" },
          { id: "bytes_allocated", label: "Memory", format: "bytes" },
          { id: "element_count", label: "Elements", format: "number" },
          { id: "hit_rate", label: "Hit rate", format: "number" },
          {
            id: "last_successful_update_time",
            label: "Last updated",
            format: "timestamp",
          },
          { id: "last_exception", label: "Last error", format: "text" },
        ],
      },
    },
    {
      id: "functions",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Functions",
        navigation: childNavigation("explorer", "explorer"),
        columns: [
          { id: "name", label: "Function", format: "code" },
          { id: "is_aggregate", label: "Aggregate", format: "status" },
          {
            id: "case_insensitive",
            label: "Case-insensitive",
            format: "status",
          },
          { id: "alias_to", label: "Alias for", format: "code" },
          { id: "syntax", label: "Syntax", format: "code" },
          { id: "categories", label: "Category", format: "text" },
          { id: "introduced_in", label: "Introduced", format: "text" },
          { id: "description", label: "Description", format: "text" },
        ],
      },
    },
    {
      id: "metrics",
      authorization: "inspect",
      view: {
        kind: "service-info",
        title: "Metrics",
        navigation: navigation("overview"),
      },
    },
    {
      id: "running-queries",
      authorization: "inspect",
      view: {
        kind: "table-browser",
        title: "Running queries",
        navigation: navigation("query"),
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
        navigation: navigation("query"),
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
        navigation: navigation("operations"),
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
        navigation: navigation("operations"),
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
        navigation: navigation("operations"),
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
        navigation: navigation("operations"),
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
        navigation: navigation("operations"),
        columns: [
          { id: "cluster", label: "Cluster", format: "code" },
          { id: "shard_num", label: "Shard", format: "number" },
          { id: "replica_num", label: "Replica", format: "number" },
          { id: "host_name", label: "Host", format: "code" },
          { id: "port", label: "Port", format: "number" },
        ],
      },
    },
    {
      id: "system-errors",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "System errors",
        navigation: navigation("operations"),
        columns: [
          { id: "name", label: "Error", format: "code" },
          { id: "code", label: "Code", format: "number" },
          { id: "value", label: "Count", format: "number" },
          { id: "last_error_time", label: "Last seen", format: "timestamp" },
          { id: "last_error_message", label: "Message", format: "text" },
          { id: "query_id", label: "Query ID", format: "code" },
        ],
      },
    },
    {
      id: "system-events",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "System events",
        navigation: navigation("operations"),
        columns: [
          { id: "event", label: "Event", format: "code" },
          { id: "value", label: "Count", format: "number" },
          { id: "description", label: "Description", format: "text" },
        ],
      },
    },
    {
      id: "asynchronous-metrics",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Asynchronous metrics",
        navigation: navigation("operations"),
        columns: [
          { id: "metric", label: "Metric", format: "code" },
          { id: "value", label: "Value", format: "number" },
          { id: "description", label: "Description", format: "text" },
        ],
      },
    },
    {
      id: "disks",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Disks",
        navigation: navigation("operations"),
        columns: [
          { id: "name", label: "Disk", format: "code" },
          { id: "type", label: "Type", format: "text" },
          { id: "path", label: "Path", format: "code" },
          { id: "free_space", label: "Free", format: "bytes" },
          { id: "total_space", label: "Total", format: "bytes" },
          { id: "unreserved_space", label: "Unreserved", format: "bytes" },
          { id: "is_read_only", label: "Read-only", format: "status" },
        ],
      },
    },
    {
      id: "settings",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Settings",
        navigation: navigation("operations"),
        columns: [
          { id: "name", label: "Setting", format: "code" },
          { id: "value", label: "Value", format: "code" },
          { id: "changed", label: "Changed", format: "status" },
          { id: "type", label: "Type", format: "code" },
          { id: "readonly", label: "Read-only", format: "status" },
          { id: "description", label: "Description", format: "text" },
        ],
      },
    },
    {
      id: "detached-parts",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Detached parts",
        navigation: navigation("operations"),
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "table", label: "Table", format: "code" },
          { id: "name", label: "Part", format: "code" },
          { id: "partition_id", label: "Partition", format: "code" },
          { id: "bytes_on_disk", label: "Size", format: "bytes" },
          { id: "modification_time", label: "Modified", format: "timestamp" },
          { id: "disk", label: "Disk", format: "code" },
          { id: "reason", label: "Reason", format: "text" },
        ],
      },
    },
    {
      id: "users",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Users",
        navigation: navigation("governance"),
        columns: [
          { id: "name", label: "User", format: "code" },
          { id: "auth_type", label: "Authentication", format: "text" },
          { id: "host_names", label: "Hosts", format: "text" },
          { id: "default_roles_list", label: "Default roles", format: "text" },
          { id: "default_database", label: "Default database", format: "code" },
          { id: "storage", label: "Storage", format: "text" },
        ],
      },
    },
    {
      id: "roles",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Roles",
        navigation: navigation("governance"),
        columns: [
          { id: "name", label: "Role", format: "code" },
          { id: "id", label: "ID", format: "code" },
          { id: "storage", label: "Storage", format: "text" },
        ],
      },
    },
    {
      id: "grants",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Grants",
        navigation: navigation("governance"),
        columns: [
          { id: "user_name", label: "User", format: "code" },
          { id: "role_name", label: "Role", format: "code" },
          { id: "access_type", label: "Access", format: "code" },
          { id: "database", label: "Database", format: "code" },
          { id: "table", label: "Table", format: "code" },
          { id: "column", label: "Column", format: "code" },
          {
            id: "is_partial_revoke",
            label: "Partial revoke",
            format: "status",
          },
          { id: "grant_option", label: "Grant option", format: "status" },
        ],
      },
    },
    {
      id: "row-policies",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Row policies",
        navigation: navigation("governance"),
        columns: [
          { id: "short_name", label: "Policy", format: "code" },
          { id: "database", label: "Database", format: "code" },
          { id: "table", label: "Table", format: "code" },
          { id: "select_filter", label: "Filter", format: "code" },
          { id: "is_restrictive", label: "Restrictive", format: "status" },
          { id: "apply_to_all", label: "All", format: "status" },
          { id: "apply_to_list", label: "Applies to", format: "text" },
        ],
      },
    },
    {
      id: "quotas",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Quotas",
        navigation: navigation("governance"),
        columns: [
          { id: "name", label: "Quota", format: "code" },
          { id: "keys", label: "Keys", format: "text" },
          { id: "durations", label: "Durations", format: "text" },
          { id: "apply_to_all", label: "All", format: "status" },
          { id: "apply_to_list", label: "Applies to", format: "text" },
          { id: "storage", label: "Storage", format: "text" },
        ],
      },
    },
    {
      id: "settings-profiles",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Settings profiles",
        navigation: navigation("governance"),
        columns: [
          { id: "name", label: "Profile", format: "code" },
          { id: "num_elements", label: "Settings", format: "number" },
          { id: "apply_to_all", label: "All", format: "status" },
          { id: "apply_to_list", label: "Applies to", format: "text" },
          { id: "storage", label: "Storage", format: "text" },
        ],
      },
    },
    {
      id: "table-detail",
      authorization: "inspect",
      view: {
        kind: "record-detail",
        title: "Table detail",
        navigation: childNavigation("explorer", "explorer"),
        description:
          "Inspect a table's engine, definition, size, and metadata.",
        fields: [
          { id: "database", label: "Database", type: "text", required: true },
          { id: "table", label: "Table", type: "text", required: true },
        ],
        columns: [
          { id: "database", label: "Database", format: "code" },
          { id: "name", label: "Table", format: "code" },
          { id: "engine", label: "Engine", format: "text" },
          { id: "partition_key", label: "Partition key", format: "code" },
          { id: "sorting_key", label: "Sorting key", format: "code" },
          { id: "primary_key", label: "Primary key", format: "code" },
          { id: "total_rows", label: "Rows", format: "number" },
          { id: "total_bytes", label: "Bytes", format: "bytes" },
          { id: "create_table_query", label: "Definition", format: "code" },
          { id: "comment", label: "Comment", format: "text" },
        ],
      },
    },
    {
      id: "query-detail",
      authorization: "inspect",
      view: {
        kind: "record-detail",
        title: "Query detail",
        navigation: navigation("query"),
        description: "Inspect the latest query-log entry for a query ID.",
        fields: [
          { id: "queryId", label: "Query ID", type: "text", required: true },
        ],
        columns: [
          { id: "query_id", label: "Query ID", format: "code" },
          { id: "type", label: "Type", format: "status" },
          { id: "user", label: "User", format: "text" },
          { id: "event_time", label: "Event time", format: "timestamp" },
          { id: "query_duration_ms", label: "Duration (ms)", format: "number" },
          { id: "read_rows", label: "Read rows", format: "number" },
          { id: "read_bytes", label: "Read bytes", format: "bytes" },
          { id: "written_rows", label: "Written rows", format: "number" },
          { id: "memory_usage", label: "Memory", format: "bytes" },
          { id: "exception", label: "Exception", format: "text" },
          { id: "query", label: "Query", format: "code" },
        ],
      },
    },
    {
      id: "query-insights",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "table-browser",
        title: "Query insights",
        navigation: navigation("query"),
        description:
          "Slow and frequently executed queries from the last 24 hours.",
        columns: [
          { id: "normalized_query_hash", label: "Query hash", format: "code" },
          { id: "executions", label: "Executions", format: "number" },
          { id: "p50_ms", label: "p50 (ms)", format: "number" },
          { id: "p90_ms", label: "p90 (ms)", format: "number" },
          { id: "p99_ms", label: "p99 (ms)", format: "number" },
          { id: "read_rows", label: "Read rows", format: "number" },
          { id: "peak_memory", label: "Peak memory", format: "bytes" },
          { id: "sample_query", label: "Sample query", format: "code" },
        ],
      },
    },
    {
      id: "query-plan",
      authorization: "execute",
      supportsCancellation: true,
      view: {
        kind: "tree",
        title: "Query plan",
        navigation: navigation("query"),
        description:
          "Run EXPLAIN with index usage details without executing the query.",
        fields: [
          {
            id: "sql",
            label: "SQL",
            type: "text",
            required: true,
            placeholder: "SELECT …",
          },
        ],
      },
    },
    {
      id: "kill-query",
      authorization: "execute",
      view: {
        kind: "action-form",
        title: "Kill query",
        navigation: navigation("query"),
        description:
          "Synchronously stop a running query by its exact query ID.",
        fields: [
          { id: "queryId", label: "Query ID", type: "text", required: true },
        ],
      },
    },
    {
      id: "create-user",
      authorization: "execute",
      view: {
        kind: "action-form",
        title: "Create user",
        navigation: navigation("administration"),
        fields: [
          { id: "name", label: "User name", type: "text", required: true },
          {
            id: "password",
            label: "Password",
            type: "password",
            required: true,
            secret: true,
          },
        ],
      },
    },
    {
      id: "alter-user-password",
      authorization: "execute",
      view: {
        kind: "action-form",
        title: "Change user password",
        navigation: navigation("administration"),
        fields: [
          { id: "name", label: "User name", type: "text", required: true },
          {
            id: "password",
            label: "New password",
            type: "password",
            required: true,
            secret: true,
          },
        ],
      },
    },
    {
      id: "drop-user",
      authorization: "execute",
      view: {
        kind: "action-form",
        title: "Drop user",
        navigation: navigation("administration"),
        fields: [
          { id: "name", label: "User name", type: "text", required: true },
        ],
      },
    },
    {
      id: "create-role",
      authorization: "execute",
      view: {
        kind: "action-form",
        title: "Create role",
        navigation: navigation("administration"),
        fields: [
          { id: "name", label: "Role name", type: "text", required: true },
        ],
      },
    },
    {
      id: "drop-role",
      authorization: "execute",
      view: {
        kind: "action-form",
        title: "Drop role",
        navigation: navigation("administration"),
        fields: [
          { id: "name", label: "Role name", type: "text", required: true },
        ],
      },
    },
    {
      id: "grant-role",
      authorization: "execute",
      view: {
        kind: "action-form",
        title: "Grant role",
        navigation: navigation("administration"),
        fields: [
          { id: "role", label: "Role", type: "text", required: true },
          { id: "user", label: "User", type: "text", required: true },
        ],
      },
    },
    {
      id: "revoke-role",
      authorization: "execute",
      view: {
        kind: "action-form",
        title: "Revoke role",
        navigation: navigation("administration"),
        fields: [
          { id: "role", label: "Role", type: "text", required: true },
          { id: "user", label: "User", type: "text", required: true },
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
    function statementUrl(parameters: Record<string, string> = {}): URL {
      const url = new URL(`${base(connection)}/`);
      if (connection.database)
        url.searchParams.set("database", connection.database);
      for (const [name, value] of Object.entries(parameters))
        url.searchParams.set(`param_${name}`, value);
      return url;
    }
    async function assertSuccessful(response: Response): Promise<void> {
      if (response.ok) return;
      const detail = (await response.text().catch(() => "")) ?? "";
      throw new Error(
        `ClickHouse request failed (${response.status}): ${detail.slice(0, 500)}`,
      );
    }
    async function runStatement(
      sql: string,
      parameters: Record<string, string> = {},
    ): Promise<Page> {
      const response = await request(statementUrl(parameters), {
        method: "POST",
        headers: { ...authHeaders(connection), "Content-Type": "text/plain" },
        body: cappedQuery(sql),
        signal: context.signal,
      });
      await assertSuccessful(response);
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
    async function runCommand(sql: string, parameters: Record<string, string>) {
      const response = await request(statementUrl(parameters), {
        method: "POST",
        headers: { ...authHeaders(connection), "Content-Type": "text/plain" },
        body: sql,
        signal: context.signal,
      });
      await assertSuccessful(response);
      return { items: [{ status: "ok" }], columns: ["status"] };
    }
    async function select(
      sql: string,
      parameters: Record<string, string> = {},
    ) {
      const page = await runStatement(sql, parameters);
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
        if (operationId === "database-objects") {
          const { database } = z
            .object({ database: z.string().min(1) })
            .parse(input);
          return select(
            "SELECT database, name, multiIf(engine = 'MaterializedView', 'materialized-view', engine IN ('View', 'LiveView', 'WindowView'), 'view', engine = 'Dictionary', 'dictionary', 'table') AS object_type, engine, total_rows, total_bytes FROM system.tables WHERE database = {database:String} ORDER BY object_type, name",
            { database },
          );
        }
        if (operationId === "table-overview") {
          const { database, table } = tableIdentitySchema.parse(input);
          return select(
            "SELECT database, name, engine, uuid, partition_key, sorting_key, primary_key, sampling_key, total_rows, total_bytes, total_bytes_uncompressed, parts, active_parts, metadata_modification_time, comment FROM system.tables WHERE database = {database:String} AND name = {table:String} LIMIT 1",
            { database, table },
          );
        }
        if (operationId === "table-columns") {
          const { database, table } = tableIdentitySchema.parse(input);
          return select(
            "SELECT name, type, position, default_kind, default_expression, compression_codec, ttl_expression, comment FROM system.columns WHERE database = {database:String} AND table = {table:String} ORDER BY position",
            { database, table },
          );
        }
        if (operationId === "table-preview") {
          const { database, table, limit, offset } =
            tablePageSchema.parse(input);
          return select(
            "SELECT * FROM {database:Identifier}.{table:Identifier} LIMIT {limit:UInt32} OFFSET {offset:UInt64}",
            {
              database,
              table,
              limit: String(limit),
              offset: String(offset),
            },
          );
        }
        if (operationId === "table-ddl") {
          const { database, table } = tableIdentitySchema.parse(input);
          return select(
            "SHOW CREATE TABLE {database:Identifier}.{table:Identifier}",
            { database, table },
          );
        }
        if (operationId === "table-parts") {
          const { database, table, limit, offset } =
            tablePageSchema.parse(input);
          return select(
            "SELECT partition, name, rows, bytes_on_disk, marks, disk_name, modification_time FROM system.parts WHERE active AND database = {database:String} AND table = {table:String} ORDER BY modification_time DESC LIMIT {limit:UInt32} OFFSET {offset:UInt64}",
            {
              database,
              table,
              limit: String(limit),
              offset: String(offset),
            },
          );
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
        if (operationId === "views")
          return select(
            "SELECT database, name, engine, as_select, comment FROM system.tables WHERE engine IN ('View', 'LiveView', 'WindowView') ORDER BY database, name",
          );
        if (operationId === "materialized-views")
          return select(
            "SELECT database, name, target_database, target_table, as_select, comment FROM system.tables WHERE engine = 'MaterializedView' ORDER BY database, name",
          );
        if (operationId === "dictionaries")
          return select(
            "SELECT database, name, status, type, bytes_allocated, element_count, hit_rate, last_successful_update_time, last_exception FROM system.dictionaries ORDER BY database, name",
          );
        if (operationId === "functions")
          return select(
            "SELECT name, is_aggregate, case_insensitive, alias_to, syntax, categories, introduced_in, description FROM system.functions ORDER BY name",
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
        if (operationId === "system-errors")
          return select(
            "SELECT name, code, value, last_error_time, last_error_message, query_id FROM system.errors WHERE value > 0 ORDER BY value DESC, code",
          );
        if (operationId === "system-events")
          return select(
            "SELECT event, value, description FROM system.events ORDER BY value DESC, event",
          );
        if (operationId === "asynchronous-metrics")
          return select(
            "SELECT metric, value, description FROM system.asynchronous_metrics ORDER BY metric",
          );
        if (operationId === "disks")
          return select(
            "SELECT name, type, path, free_space, total_space, unreserved_space, is_read_only FROM system.disks ORDER BY name",
          );
        if (operationId === "settings")
          return select(
            "SELECT name, value, changed, type, readonly, description FROM system.settings ORDER BY name",
          );
        if (operationId === "detached-parts")
          return select(
            "SELECT database, table, name, partition_id, bytes_on_disk, modification_time, disk, reason FROM system.detached_parts ORDER BY modification_time DESC, database, table, name",
          );
        if (operationId === "users")
          return select(
            "SELECT name, auth_type, host_names, default_roles_list, default_database, storage FROM system.users ORDER BY name",
          );
        if (operationId === "roles")
          return select(
            "SELECT name, id, storage FROM system.roles ORDER BY name",
          );
        if (operationId === "grants")
          return select(
            "SELECT user_name, role_name, access_type, database, table, column, is_partial_revoke, grant_option FROM system.grants ORDER BY user_name, role_name, access_type",
          );
        if (operationId === "row-policies")
          return select(
            "SELECT short_name, database, table, select_filter, is_restrictive, apply_to_all, apply_to_list FROM system.row_policies ORDER BY database, table, short_name",
          );
        if (operationId === "quotas")
          return select(
            "SELECT name, keys, durations, apply_to_all, apply_to_list, storage FROM system.quotas ORDER BY name",
          );
        if (operationId === "settings-profiles")
          return select(
            "SELECT name, num_elements, apply_to_all, apply_to_list, storage FROM system.settings_profiles ORDER BY name",
          );
        if (operationId === "table-detail") {
          const { database, table } = z
            .object({ database: z.string().min(1), table: z.string().min(1) })
            .parse(input);
          return select(
            "SELECT database, name, engine, partition_key, sorting_key, primary_key, total_rows, total_bytes, create_table_query, comment FROM system.tables WHERE database = {database:String} AND name = {table:String} LIMIT 1",
            { database, table },
          );
        }
        if (operationId === "query-detail") {
          const { queryId } = z
            .object({ queryId: z.string().min(1) })
            .parse(input);
          return select(
            "SELECT query_id, type, user, event_time, query_duration_ms, read_rows, read_bytes, written_rows, memory_usage, exception, query FROM system.query_log WHERE query_id = {queryId:String} ORDER BY event_time DESC LIMIT 1",
            { queryId },
          );
        }
        if (operationId === "query-insights")
          return select(
            "SELECT normalized_query_hash, count() AS executions, quantile(0.50)(query_duration_ms) AS p50_ms, quantile(0.90)(query_duration_ms) AS p90_ms, quantile(0.99)(query_duration_ms) AS p99_ms, sum(read_rows) AS read_rows, max(memory_usage) AS peak_memory, any(query) AS sample_query FROM system.query_log WHERE type = 'QueryFinish' AND event_time >= now() - INTERVAL 24 HOUR GROUP BY normalized_query_hash ORDER BY p99_ms DESC LIMIT 200",
          );
        if (operationId === "query-plan") {
          const { sql } = z.object({ sql: z.string().min(1) }).parse(input);
          return select(`EXPLAIN indexes = 1 ${sql}`);
        }
        if (operationId === "kill-query") {
          const { queryId } = z
            .object({ queryId: z.string().min(1) })
            .parse(input);
          return runCommand(
            "KILL QUERY WHERE query_id = {queryId:String} SYNC",
            { queryId },
          );
        }
        if (operationId === "create-user") {
          const { name, password } = z
            .object({ name: z.string().min(1), password: z.string().min(1) })
            .parse(input);
          return runCommand(
            "CREATE USER {name:Identifier} IDENTIFIED WITH sha256_password BY {password:String}",
            { name, password },
          );
        }
        if (operationId === "alter-user-password") {
          const { name, password } = z
            .object({ name: z.string().min(1), password: z.string().min(1) })
            .parse(input);
          return runCommand(
            "ALTER USER {name:Identifier} IDENTIFIED WITH sha256_password BY {password:String}",
            { name, password },
          );
        }
        if (operationId === "drop-user") {
          const { name } = z.object({ name: z.string().min(1) }).parse(input);
          return runCommand("DROP USER {name:Identifier}", { name });
        }
        if (operationId === "create-role") {
          const { name } = z.object({ name: z.string().min(1) }).parse(input);
          return runCommand("CREATE ROLE {name:Identifier}", { name });
        }
        if (operationId === "drop-role") {
          const { name } = z.object({ name: z.string().min(1) }).parse(input);
          return runCommand("DROP ROLE {name:Identifier}", { name });
        }
        if (operationId === "grant-role") {
          const { role, user } = z
            .object({ role: z.string().min(1), user: z.string().min(1) })
            .parse(input);
          return runCommand("GRANT {role:Identifier} TO {user:Identifier}", {
            role,
            user,
          });
        }
        if (operationId === "revoke-role") {
          const { role, user } = z
            .object({ role: z.string().min(1), user: z.string().min(1) })
            .parse(input);
          return runCommand("REVOKE {role:Identifier} FROM {user:Identifier}", {
            role,
            user,
          });
        }
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
