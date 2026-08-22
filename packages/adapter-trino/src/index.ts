import { ADAPTER_SDK_VERSION, defineAdapter, z } from "@dsui/adapter-sdk";

const connectionSchema = z.object({
  host: z.string().min(1), port: z.coerce.number().int().positive().default(8080),
  protocol: z.enum(["http", "https"]).default("http"), username: z.string().min(1),
  password: z.string().optional(), catalog: z.string().optional(), schema: z.string().optional(),
});
type Connection = z.output<typeof connectionSchema>;
const base = (c: Connection) => `${c.protocol}://${c.host}:${c.port}`;
function headers(c: Connection): HeadersInit { return { "X-Trino-User": c.username, ...(c.catalog ? { "X-Trino-Catalog": c.catalog } : {}), ...(c.schema ? { "X-Trino-Schema": c.schema } : {}), ...(c.password ? { Authorization: `Basic ${btoa(`${c.username}:${c.password}`)}` } : {}) }; }

export const trinoAdapter = defineAdapter({
  id: "trino", version: "0.1.0", sdkVersion: ADAPTER_SDK_VERSION,
  metadata: { id: "trino", name: "Trino", category: "Query engine", description: "Browse metadata and execute Trino SQL.", icon: "trino" },
  connectionSchema,
  connectionFields: [
    { id: "host", label: "Host", type: "text", required: true, placeholder: "trino" }, { id: "port", label: "Port", type: "number", required: true, placeholder: "8080" },
    { id: "username", label: "Username", type: "text", required: true }, { id: "password", label: "Password", type: "password", secret: true },
    { id: "catalog", label: "Default catalog", type: "text" }, { id: "schema", label: "Default schema", type: "text" },
  ], secretPaths: ["password"],
  capabilities: [
    { id: "service-info", authorization: "inspect", view: { kind: "service-info", title: "Service information" } },
    { id: "query", authorization: "execute", supportsCancellation: true, view: { kind: "query", title: "Query", dialect: "trino" } },
    { id: "schemas", authorization: "inspect", supportsPagination: true, view: { kind: "schema-browser", title: "Catalogs and schemas", columns: [{ id: "catalog", label: "Catalog", format: "code" }, { id: "schema", label: "Schema", format: "code" }] } },
    { id: "tables", authorization: "inspect", supportsPagination: true, view: { kind: "table-browser", title: "Tables", columns: [{ id: "catalog", label: "Catalog", format: "code" }, { id: "schema", label: "Schema", format: "code" }, { id: "name", label: "Table", format: "code" }] } },
  ],
  create(context, connection) {
    const request = context.fetch ?? fetch;
    async function statement(sql: string) {
      const response = await request(`${base(connection)}/v1/statement`, { method: "POST", headers: { ...headers(connection), "Content-Type": "text/plain" }, body: sql, signal: context.signal });
      if (!response.ok) throw new Error(`Trino request failed (${response.status})`);
      return response.json() as Promise<Record<string, unknown>>;
    }
    return {
      async health() { const started = Date.now(); try { const r = await statement("SELECT 1"); return { status: r.error ? "warning" : "healthy", checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, detail: r.error ? "Trino returned an error" : undefined }; } catch { return { status: "unavailable", checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, detail: "Unable to reach Trino" }; } },
      async execute(operationId, input) {
        if (operationId === "query") return statement(z.object({ sql: z.string().min(1) }).parse(input).sql);
        if (operationId === "schemas") return statement("SELECT catalog_name AS catalog, schema_name AS schema FROM system.metadata.schemas ORDER BY 1, 2");
        if (operationId === "tables") return statement("SELECT table_catalog AS catalog, table_schema AS schema, table_name AS name FROM information_schema.tables ORDER BY 1, 2, 3");
        if (operationId === "service-info") return { items: [{ label: "Endpoint", value: base(connection), format: "code" }] };
        throw new Error(`Unsupported Trino operation: ${operationId}`);
      },
    };
  },
});
export default trinoAdapter;
