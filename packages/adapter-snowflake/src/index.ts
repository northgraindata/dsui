import { randomUUID } from "node:crypto";
import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const connectionSchema = z.object({
  accountIdentifier: z.string().min(1),
  token: z.string().min(1),
  host: z.string().url().optional(),
  warehouse: z.string().optional(),
  database: z.string().optional(),
  schema: z.string().optional(),
  role: z.string().optional(),
});
const sqlInput = z.object({ sql: z.string().min(1).max(1_000_000) });
type SnowflakeResult = {
  code?: string;
  message?: string;
  statementHandle?: string;
  statementStatusUrl?: string;
  data?: unknown[][];
  resultSetMetaData?: { rowType?: Array<{ name?: string }> };
};

export const snowflakeAdapter = defineAdapter({
  id: "snowflake",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "snowflake",
    name: "Snowflake",
    category: "Data warehouse",
    description:
      "Browse Snowflake objects, warehouses, history, and execute SQL.",
    icon: "snowflake",
    docsUrl: "https://docs.snowflake.com/en/developer-guide/sql-api/index",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "accountIdentifier",
      label: "Account identifier",
      type: "text",
      required: true,
      placeholder: "org-account",
    },
    {
      id: "host",
      label: "Custom endpoint",
      type: "url",
      placeholder: "https://org-account.snowflakecomputing.com",
    },
    {
      id: "token",
      label: "OAuth or programmatic access token",
      type: "password",
      required: true,
      secret: true,
    },
    { id: "warehouse", label: "Warehouse", type: "text" },
    { id: "database", label: "Database", type: "text" },
    { id: "schema", label: "Schema", type: "text" },
    { id: "role", label: "Role", type: "text" },
  ],
  secretPaths: ["token"],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Account" },
    },
    {
      id: "query",
      authorization: "execute",
      supportsCancellation: true,
      view: { kind: "query", title: "Query", dialect: "snowflake" },
    },
    {
      id: "databases",
      authorization: "inspect",
      view: { kind: "schema-browser", title: "Databases" },
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
      id: "warehouses",
      authorization: "inspect",
      view: { kind: "service-info", title: "Warehouses" },
    },
    {
      id: "query-history",
      authorization: "inspect",
      view: { kind: "table-browser", title: "Query history" },
    },
    {
      id: "tasks",
      authorization: "inspect",
      view: { kind: "job-browser", title: "Tasks" },
    },
  ],
  create(context, connection) {
    const fetchFn = context.fetch ?? fetch;
    const base = (
      connection.host ??
      `https://${connection.accountIdentifier}.snowflakecomputing.com`
    ).replace(/\/$/, "");
    const headers = {
      Authorization: `Bearer ${connection.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "dsui-snowflake/0.1",
    };
    async function decode(response: Response): Promise<SnowflakeResult> {
      const result = (await response
        .json()
        .catch(() => ({}))) as SnowflakeResult;
      if (!response.ok && response.status !== 202)
        throw new Error(
          result.message ?? `Snowflake responded ${response.status}`,
        );
      return result;
    }
    async function statement(sql: string) {
      let result = await decode(
        await fetchFn(`${base}/api/v2/statements?requestId=${randomUUID()}`, {
          method: "POST",
          headers,
          signal: context.signal,
          body: JSON.stringify({
            statement: sql,
            timeout: 60,
            ...(connection.warehouse
              ? { warehouse: connection.warehouse }
              : {}),
            ...(connection.database ? { database: connection.database } : {}),
            ...(connection.schema ? { schema: connection.schema } : {}),
            ...(connection.role ? { role: connection.role } : {}),
          }),
        }),
      );
      for (
        let attempt = 0;
        result.statementHandle && !result.data && attempt < 120;
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        result = await decode(
          await fetchFn(
            `${base}/api/v2/statements/${encodeURIComponent(result.statementHandle)}`,
            {
              headers,
              signal: context.signal,
            },
          ),
        );
      }
      if (!result.data && result.statementHandle)
        throw new Error(
          "Snowflake statement did not finish before the polling limit",
        );
      if (result.code && result.code !== "090001")
        throw new Error(result.message ?? `Snowflake SQL error ${result.code}`);
      return {
        items: result.data ?? [],
        columns:
          result.resultSetMetaData?.rowType?.map(
            (column) => column.name ?? "",
          ) ?? [],
      };
    }
    return {
      async health() {
        const started = Date.now();
        try {
          await statement("SELECT 1");
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
            detail: "Unable to execute Snowflake SQL",
          };
        }
      },
      async execute(operationId, input) {
        if (operationId === "query")
          return statement(sqlInput.parse(input).sql);
        if (operationId === "service-info")
          return statement(
            "SELECT CURRENT_ACCOUNT() AS account, CURRENT_ORGANIZATION_NAME() AS organization, CURRENT_REGION() AS region, CURRENT_ROLE() AS role, CURRENT_WAREHOUSE() AS warehouse, CURRENT_DATABASE() AS database, CURRENT_SCHEMA() AS schema",
          );
        if (operationId === "databases") return statement("SHOW DATABASES");
        if (operationId === "schemas") return statement("SHOW SCHEMAS");
        if (operationId === "tables") return statement("SHOW TABLES");
        if (operationId === "views") return statement("SHOW VIEWS");
        if (operationId === "warehouses") return statement("SHOW WAREHOUSES");
        if (operationId === "tasks") return statement("SHOW TASKS");
        if (operationId === "query-history")
          return statement(
            "SELECT query_id, user_name, warehouse_name, execution_status, start_time, end_time, total_elapsed_time, rows_produced, bytes_scanned, query_text FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(END_TIME_RANGE_START=>DATEADD('hour',-24,CURRENT_TIMESTAMP()), RESULT_LIMIT=>500)) ORDER BY start_time DESC",
          );
        throw new Error(`Unsupported Snowflake operation: ${operationId}`);
      },
    };
  },
});

export default snowflakeAdapter;
