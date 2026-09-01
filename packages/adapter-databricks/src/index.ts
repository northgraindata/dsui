import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const connectionSchema = z.object({
  workspaceUrl: z.string().url(),
  token: z.string().min(1),
  warehouseId: z.string().min(1),
  catalog: z.string().default("hive_metastore"),
  schema: z.string().default("default"),
});
const sqlInput = z.object({ sql: z.string().min(1).max(1_000_000) });
type Statement = {
  statement_id?: string;
  status?: { state?: string; error?: { message?: string } };
  manifest?: { schema?: { columns?: Array<{ name?: string }> } };
  result?: { data_array?: unknown[][]; next_chunk_internal_link?: string };
};

export const databricksAdapter = defineAdapter({
  id: "databricks",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "databricks",
    name: "Databricks",
    category: "Lakehouse",
    description:
      "Browse Unity Catalog, SQL warehouses, compute, jobs, and pipelines.",
    icon: "databricks",
    docsUrl: "https://docs.databricks.com/api/workspace/introduction",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "workspaceUrl",
      label: "Workspace URL",
      type: "url",
      required: true,
      placeholder: "https://workspace.cloud.databricks.com",
    },
    {
      id: "token",
      label: "Personal access token",
      type: "password",
      required: true,
      secret: true,
    },
    {
      id: "warehouseId",
      label: "SQL warehouse ID",
      type: "text",
      required: true,
    },
    { id: "catalog", label: "Default catalog", type: "text" },
    { id: "schema", label: "Default schema", type: "text" },
  ],
  secretPaths: ["token"],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Workspace" },
    },
    {
      id: "query",
      authorization: "execute",
      supportsCancellation: true,
      view: { kind: "query", title: "SQL editor", dialect: "databricks-sql" },
    },
    {
      id: "catalogs",
      authorization: "inspect",
      view: { kind: "schema-browser", title: "Catalogs" },
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
      id: "warehouses",
      authorization: "inspect",
      view: { kind: "service-info", title: "SQL warehouses" },
    },
    {
      id: "clusters",
      authorization: "inspect",
      view: { kind: "service-info", title: "Compute" },
    },
    {
      id: "jobs",
      authorization: "inspect",
      view: { kind: "job-browser", title: "Jobs" },
    },
    {
      id: "runs",
      authorization: "inspect",
      view: { kind: "job-browser", title: "Job runs" },
    },
    {
      id: "pipelines",
      authorization: "inspect",
      view: { kind: "job-browser", title: "Pipelines" },
    },
    {
      id: "run-job",
      authorization: "execute",
      view: { kind: "action-form", title: "Run job" },
    },
    {
      id: "cancel-run",
      authorization: "execute",
      view: { kind: "action-form", title: "Cancel run" },
    },
  ],
  create(context, connection) {
    const fetchFn = context.fetch ?? fetch;
    const base = connection.workspaceUrl.replace(/\/$/, "");
    const headers = {
      Authorization: `Bearer ${connection.token}`,
      "Content-Type": "application/json",
    };
    async function api<T>(path: string, init?: RequestInit): Promise<T> {
      const response = await fetchFn(`${base}${path}`, {
        ...init,
        headers: { ...headers, ...(init?.headers ?? {}) },
        signal: context.signal,
      });
      const body = (await response.json().catch(() => ({}))) as T & {
        error_code?: string;
        message?: string;
      };
      if (!response.ok)
        throw new Error(
          body.message ??
            body.error_code ??
            `Databricks responded ${response.status}`,
        );
      return body;
    }
    async function query(sql: string) {
      let statement = await api<Statement>("/api/2.0/sql/statements", {
        method: "POST",
        body: JSON.stringify({
          statement: sql,
          warehouse_id: connection.warehouseId,
          catalog: connection.catalog,
          schema: connection.schema,
          wait_timeout: "10s",
          disposition: "INLINE",
          format: "JSON_ARRAY",
        }),
      });
      for (
        let attempt = 0;
        ["PENDING", "RUNNING"].includes(statement.status?.state ?? "") &&
        statement.statement_id &&
        attempt < 120;
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        statement = await api<Statement>(
          `/api/2.0/sql/statements/${encodeURIComponent(statement.statement_id)}`,
        );
      }
      if (statement.status?.state !== "SUCCEEDED")
        throw new Error(
          statement.status?.error?.message ??
            `Databricks statement ${statement.status?.state ?? "failed"}`,
        );
      const columns =
        statement.manifest?.schema?.columns?.map(
          (column) => column.name ?? "",
        ) ?? [];
      const items = (statement.result?.data_array ?? []).map((row) =>
        Object.fromEntries(
          columns.map((column, index) => [column, row[index]]),
        ),
      );
      return {
        items,
        columns,
        ...(statement.result?.next_chunk_internal_link
          ? {
              warnings: [
                "Additional result chunks are available; showing the inline chunk",
              ],
            }
          : {}),
      };
    }
    return {
      async health() {
        const started = Date.now();
        try {
          await query("SELECT 1 AS ok");
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
            detail: "Unable to execute Databricks SQL",
          };
        }
      },
      async execute(operationId, input) {
        if (operationId === "query") return query(sqlInput.parse(input).sql);
        if (operationId === "service-info") {
          const current = await api<{
            userName?: string;
            displayName?: string;
            active?: boolean;
          }>("/api/2.0/preview/scim/v2/Me");
          return {
            items: [
              { label: "Workspace", value: base, format: "code" },
              {
                label: "User",
                value: current.displayName ?? current.userName ?? "",
              },
              {
                label: "SQL warehouse",
                value: connection.warehouseId,
                format: "code",
              },
              { label: "Catalog", value: connection.catalog, format: "code" },
              { label: "Schema", value: connection.schema, format: "code" },
            ],
          };
        }
        if (operationId === "catalogs")
          return api<{ catalogs?: unknown[] }>(
            "/api/2.1/unity-catalog/catalogs",
          ).then((result) => ({ items: result.catalogs ?? [] }));
        if (operationId === "schemas")
          return api<{ schemas?: unknown[] }>(
            `/api/2.1/unity-catalog/schemas?catalog_name=${encodeURIComponent(connection.catalog)}`,
          ).then((result) => ({ items: result.schemas ?? [] }));
        if (operationId === "tables")
          return api<{ tables?: unknown[] }>(
            `/api/2.1/unity-catalog/tables?catalog_name=${encodeURIComponent(connection.catalog)}&schema_name=${encodeURIComponent(connection.schema)}&max_results=100`,
          ).then((result) => ({ items: result.tables ?? [] }));
        if (operationId === "warehouses")
          return api<{ warehouses?: unknown[] }>(
            "/api/2.0/sql/warehouses",
          ).then((result) => ({ items: result.warehouses ?? [] }));
        if (operationId === "clusters")
          return api<{ clusters?: unknown[] }>("/api/2.0/clusters/list").then(
            (result) => ({ items: result.clusters ?? [] }),
          );
        if (operationId === "jobs")
          return api<{
            jobs?: unknown[];
            has_more?: boolean;
            next_page_token?: string;
          }>("/api/2.1/jobs/list?limit=100&expand_tasks=true").then(
            (result) => ({
              items: result.jobs ?? [],
              nextCursor: result.next_page_token,
            }),
          );
        if (operationId === "runs")
          return api<{
            runs?: unknown[];
            has_more?: boolean;
            next_page_token?: string;
          }>("/api/2.1/jobs/runs/list?limit=100&expand_tasks=true").then(
            (result) => ({
              items: result.runs ?? [],
              nextCursor: result.next_page_token,
            }),
          );
        if (operationId === "pipelines")
          return api<{ statuses?: unknown[]; next_page_token?: string }>(
            "/api/2.0/pipelines?max_results=100",
          ).then((result) => ({
            items: result.statuses ?? [],
            nextCursor: result.next_page_token,
          }));
        if (operationId === "run-job") {
          const { jobId, parameters } = z
            .object({
              jobId: z.coerce.number().int().positive(),
              parameters: z.record(z.unknown()).optional(),
            })
            .parse(input);
          return api("/api/2.1/jobs/run-now", {
            method: "POST",
            body: JSON.stringify({
              job_id: jobId,
              ...(parameters ? { job_parameters: parameters } : {}),
            }),
          });
        }
        if (operationId === "cancel-run") {
          const { runId } = z
            .object({ runId: z.coerce.number().int().positive() })
            .parse(input);
          return api("/api/2.1/jobs/runs/cancel", {
            method: "POST",
            body: JSON.stringify({ run_id: runId }),
          });
        }
        throw new Error(`Unsupported Databricks operation: ${operationId}`);
      },
    };
  },
});

export default databricksAdapter;
