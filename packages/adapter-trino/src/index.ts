import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const connectionSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().positive().default(8080),
  protocol: z.enum(["http", "https"]).default("http"),
  username: z.string().min(1),
  password: z.string().optional(),
  catalog: z.string().optional(),
  schema: z.string().optional(),
});
type Connection = z.output<typeof connectionSchema>;
const base = (c: Connection) => `${c.protocol}://${c.host}:${c.port}`;
function headers(c: Connection): HeadersInit {
  return {
    "X-Trino-User": c.username,
    ...(c.catalog ? { "X-Trino-Catalog": c.catalog } : {}),
    ...(c.schema ? { "X-Trino-Schema": c.schema } : {}),
    ...(c.password
      ? { Authorization: `Basic ${btoa(`${c.username}:${c.password}`)}` }
      : {}),
  };
}

export const trinoAdapter = defineAdapter({
  id: "trino",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "trino",
    name: "Trino",
    category: "Query engine",
    description: "Browse metadata and execute Trino SQL.",
    icon: "trino",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "host",
      label: "Host",
      type: "text",
      required: true,
      placeholder: "trino",
    },
    {
      id: "port",
      label: "Port",
      type: "number",
      required: true,
      placeholder: "8080",
    },
    { id: "username", label: "Username", type: "text", required: true },
    { id: "password", label: "Password", type: "password", secret: true },
    { id: "catalog", label: "Default catalog", type: "text" },
    { id: "schema", label: "Default schema", type: "text" },
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
      view: { kind: "query", title: "Query", dialect: "trino" },
    },
    {
      id: "schemas",
      authorization: "inspect",
      supportsPagination: true,
      view: {
        kind: "schema-browser",
        title: "Catalogs and schemas",
        columns: [
          { id: "catalog", label: "Catalog", format: "code" },
          { id: "schema", label: "Schema", format: "code" },
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
          { id: "catalog", label: "Catalog", format: "code" },
          { id: "schema", label: "Schema", format: "code" },
          { id: "name", label: "Table", format: "code" },
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
      view: { kind: "table-browser", title: "Running queries" },
    },
  ],
  create(context, connection) {
    const request = context.fetch ?? fetch;
    const MAX_ROWS = 2000;
    type Page = {
      rows: unknown[][];
      columns: string[];
      error?: { message?: string };
      truncated: boolean;
    };
    async function runStatement(sql: string): Promise<Page> {
      const start = await request(`${base(connection)}/v1/statement`, {
        method: "POST",
        headers: { ...headers(connection), "Content-Type": "text/plain" },
        body: sql,
        signal: context.signal,
      });
      if (!start.ok) throw new Error(`Trino request failed (${start.status})`);
      let json = (await start.json()) as Record<string, unknown>;
      if (json.error)
        return {
          rows: [],
          columns: [],
          error: json.error as Page["error"],
          truncated: false,
        };
      const columns = ((json.columns as Array<{ name?: string }>) ?? []).map(
        (c) => c.name ?? "",
      );
      let rows: unknown[][] = (json.data as unknown[][]) ?? [];
      let next = json.nextUri as string | undefined;
      while (next && rows.length < MAX_ROWS) {
        const res = await request(next, {
          headers: headers(connection),
          signal: context.signal,
        });
        if (!res.ok) throw new Error(`Trino request failed (${res.status})`);
        json = (await res.json()) as Record<string, unknown>;
        if (json.error)
          return {
            rows,
            columns,
            error: json.error as Page["error"],
            truncated: rows.length >= MAX_ROWS,
          };
        if (json.data) rows = rows.concat(json.data as unknown[][]);
        next = json.nextUri as string | undefined;
      }
      const truncated = rows.length >= MAX_ROWS && Boolean(next);
      if (truncated) rows = rows.slice(0, MAX_ROWS);
      return { rows, columns, truncated };
    }
    async function select(sql: string) {
      const page = await runStatement(sql);
      if (page.error)
        throw new Error(page.error.message ?? "Trino query failed");
      return { items: page.rows, columns: page.columns };
    }
    return {
      async health() {
        const started = Date.now();
        try {
          const r = await runStatement("SELECT 1");
          return {
            status: r.error ? "warning" : "healthy",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: r.error ? "Trino returned an error" : undefined,
          };
        } catch {
          return {
            status: "unavailable",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: "Unable to reach Trino",
          };
        }
      },
      async execute(operationId, input) {
        if (operationId === "query") {
          const sql = z.object({ sql: z.string().min(1) }).parse(input).sql;
          const page = await runStatement(sql);
          if (page.error)
            throw new Error(page.error.message ?? "Trino query failed");
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
            "SELECT catalog_name AS catalog, schema_name AS schema FROM system.metadata.schemas ORDER BY 1, 2",
          );
        if (operationId === "tables")
          return select(
            "SELECT table_catalog AS catalog, table_schema AS schema, table_name AS name FROM information_schema.tables ORDER BY 1, 2, 3",
          );
        if (operationId === "service-info")
          return {
            items: [
              { label: "Endpoint", value: base(connection), format: "code" },
            ],
          };
        if (operationId === "metrics") {
          const [workers, running, queued, tables] = await Promise.all([
            runStatement(
              "SELECT COUNT(*) FROM system.runtime.nodes WHERE state = 'active'",
            ),
            runStatement(
              "SELECT COUNT(*) FROM system.runtime.queries WHERE state = 'RUNNING'",
            ),
            runStatement(
              "SELECT COUNT(*) FROM system.runtime.queries WHERE state = 'QUEUED'",
            ),
            runStatement("SELECT COUNT(*) FROM information_schema.tables"),
          ]);
          const count = (page: typeof workers) =>
            Number(page.rows[0]?.[0] ?? 0);
          return {
            items: [
              {
                label: "Worker nodes",
                value: count(workers),
                format: "number",
              },
              {
                label: "Running queries",
                value: count(running),
                format: "number",
              },
              {
                label: "Queued queries",
                value: count(queued),
                format: "number",
              },
              { label: "Tables", value: count(tables), format: "number" },
            ],
            columns: ["label", "value", "format"],
          };
        }
        if (operationId === "running-queries") {
          const page = await runStatement(
            "SELECT query_id, state, user, query, created, elapsed FROM system.runtime.queries WHERE state = 'RUNNING' ORDER BY created DESC",
          );
          if (page.error)
            throw new Error(page.error.message ?? "Trino query failed");
          return { items: page.rows, columns: page.columns };
        }
        throw new Error(`Unsupported Trino operation: ${operationId}`);
      },
    };
  },
});
export default trinoAdapter;
