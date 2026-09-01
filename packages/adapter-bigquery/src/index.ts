import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const connectionSchema = z.object({
  projectId: z.string().min(1),
  accessToken: z.string().min(1),
  location: z.string().min(1).default("US"),
});
const sqlInput = z.object({ sql: z.string().min(1).max(1_000_000) });
type Field = { name?: string; type?: string; fields?: Field[] };
type Cell = { v?: unknown };
type QueryResult = {
  jobComplete?: boolean;
  jobReference?: { jobId?: string; location?: string };
  schema?: { fields?: Field[] };
  rows?: Array<{ f?: Cell[] }>;
  pageToken?: string;
  errors?: Array<{ message?: string }>;
  error?: { message?: string };
};

function value(cell: unknown, field?: Field): unknown {
  if (cell == null) return null;
  if (typeof cell === "object" && cell && "v" in cell)
    return value((cell as Cell).v, field);
  if (
    field?.type === "RECORD" &&
    typeof cell === "object" &&
    cell &&
    "f" in cell
  ) {
    const cells = (cell as { f?: Cell[] }).f ?? [];
    return Object.fromEntries(
      (field.fields ?? []).map((child, index) => [
        child.name ?? String(index),
        value(cells[index], child),
      ]),
    );
  }
  if (Array.isArray(cell)) return cell.map((entry) => value(entry, field));
  return cell;
}

export const bigqueryAdapter = defineAdapter({
  id: "bigquery",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "bigquery",
    name: "BigQuery",
    category: "Data warehouse",
    description: "Browse BigQuery resources, jobs, and execute GoogleSQL.",
    icon: "bigquery",
    docsUrl: "https://cloud.google.com/bigquery/docs/reference/rest",
  },
  connectionSchema,
  connectionFields: [
    { id: "projectId", label: "Project ID", type: "text", required: true },
    {
      id: "location",
      label: "Location",
      type: "text",
      required: true,
      placeholder: "US",
    },
    {
      id: "accessToken",
      label: "OAuth access token",
      type: "password",
      required: true,
      secret: true,
    },
  ],
  secretPaths: ["accessToken"],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Project" },
    },
    {
      id: "query",
      authorization: "execute",
      supportsCancellation: true,
      view: { kind: "query", title: "Query", dialect: "google-sql" },
    },
    {
      id: "datasets",
      authorization: "inspect",
      supportsPagination: true,
      maxPageSize: 100,
      view: { kind: "schema-browser", title: "Datasets" },
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
      id: "routines",
      authorization: "inspect",
      view: { kind: "table-browser", title: "Routines" },
    },
    {
      id: "jobs",
      authorization: "inspect",
      supportsPagination: true,
      maxPageSize: 100,
      view: { kind: "job-browser", title: "Jobs" },
    },
  ],
  create(context, connection) {
    const fetchFn = context.fetch ?? fetch;
    const base = "https://bigquery.googleapis.com/bigquery/v2";
    const headers = {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json",
    };
    async function request<T>(path: string, init?: RequestInit): Promise<T> {
      const response = await fetchFn(`${base}${path}`, {
        ...init,
        headers: { ...headers, ...(init?.headers ?? {}) },
        signal: context.signal,
      });
      const body = (await response.json().catch(() => ({}))) as T & {
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(
          body.error?.message ?? `BigQuery responded ${response.status}`,
        );
      return body;
    }
    async function query(sql: string) {
      let result = await request<QueryResult>(
        `/projects/${encodeURIComponent(connection.projectId)}/queries`,
        {
          method: "POST",
          body: JSON.stringify({
            query: sql,
            useLegacySql: false,
            location: connection.location,
            maxResults: 2000,
            timeoutMs: 10_000,
          }),
        },
      );
      const jobId = result.jobReference?.jobId;
      for (
        let attempt = 0;
        !result.jobComplete && jobId && attempt < 120;
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        result = await request<QueryResult>(
          `/projects/${encodeURIComponent(connection.projectId)}/queries/${encodeURIComponent(jobId)}?location=${encodeURIComponent(connection.location)}&maxResults=2000`,
        );
      }
      if (!result.jobComplete)
        throw new Error("BigQuery job did not finish before the polling limit");
      if (result.errors?.length)
        throw new Error(
          result.errors
            .map((error) => error.message)
            .filter(Boolean)
            .join("; "),
        );
      const fields = result.schema?.fields ?? [];
      return {
        items: (result.rows ?? []).map((row) =>
          Object.fromEntries(
            fields.map((field, index) => [
              field.name ?? String(index),
              value(row.f?.[index], field),
            ]),
          ),
        ),
        columns: fields.map((field) => field.name ?? ""),
        ...(result.pageToken ? { nextCursor: result.pageToken } : {}),
      };
    }
    const region = `region-${connection.location.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
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
            detail: "Unable to execute a BigQuery job",
          };
        }
      },
      async execute(operationId, input) {
        if (operationId === "query") return query(sqlInput.parse(input).sql);
        if (operationId === "service-info") {
          const project = await request<{
            id?: string;
            friendlyName?: string;
            numericId?: string;
            kind?: string;
          }>(`/projects/${encodeURIComponent(connection.projectId)}`);
          return {
            items: [
              {
                label: "Project",
                value:
                  project.friendlyName ?? project.id ?? connection.projectId,
              },
              {
                label: "Project ID",
                value: project.id ?? connection.projectId,
                format: "code",
              },
              { label: "Numeric ID", value: project.numericId ?? "" },
              { label: "Location", value: connection.location },
            ],
          };
        }
        if (operationId === "datasets") {
          const parsed = z
            .object({
              limit: z.coerce.number().int().min(1).max(100).default(50),
              cursor: z.string().optional(),
            })
            .parse(input);
          const params = new URLSearchParams({
            maxResults: String(parsed.limit),
            all: "true",
          });
          if (parsed.cursor) params.set("pageToken", parsed.cursor);
          const result = await request<{
            datasets?: Array<{
              id?: string;
              datasetReference?: { datasetId?: string };
              friendlyName?: string;
              location?: string;
            }>;
            nextPageToken?: string;
          }>(
            `/projects/${encodeURIComponent(connection.projectId)}/datasets?${params}`,
          );
          return {
            items: (result.datasets ?? []).map((dataset) => ({
              id: dataset.datasetReference?.datasetId ?? dataset.id,
              name: dataset.friendlyName,
              location: dataset.location,
            })),
            nextCursor: result.nextPageToken,
          };
        }
        if (operationId === "jobs") {
          const parsed = z
            .object({
              limit: z.coerce.number().int().min(1).max(100).default(50),
              cursor: z.string().optional(),
            })
            .parse(input);
          const params = new URLSearchParams({
            maxResults: String(parsed.limit),
            allUsers: "true",
            projection: "full",
          });
          if (parsed.cursor) params.set("pageToken", parsed.cursor);
          const result = await request<{
            jobs?: unknown[];
            nextPageToken?: string;
          }>(
            `/projects/${encodeURIComponent(connection.projectId)}/jobs?${params}`,
          );
          return { items: result.jobs ?? [], nextCursor: result.nextPageToken };
        }
        if (operationId === "tables")
          return query(
            `SELECT table_schema AS dataset, table_name AS name, table_type AS type, creation_time FROM \`${connection.projectId}.${region}.INFORMATION_SCHEMA.TABLES\` ORDER BY 1,2`,
          );
        if (operationId === "views")
          return query(
            `SELECT table_schema AS dataset, table_name AS name, view_definition FROM \`${connection.projectId}.${region}.INFORMATION_SCHEMA.VIEWS\` ORDER BY 1,2`,
          );
        if (operationId === "routines")
          return query(
            `SELECT routine_schema AS dataset, routine_name AS name, routine_type, data_type, created, last_altered FROM \`${connection.projectId}.${region}.INFORMATION_SCHEMA.ROUTINES\` ORDER BY 1,2`,
          );
        throw new Error(`Unsupported BigQuery operation: ${operationId}`);
      },
    };
  },
});

export default bigqueryAdapter;
