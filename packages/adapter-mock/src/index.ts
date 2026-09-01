import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

export { createAdapterEmulator, resetAdapterEmulators } from "./emulation";

export const MOCK_SERVICE_TYPES = [
  "trino",
  "clickhouse",
  "polaris",
  "kafka",
  "s3",
  "flink",
  "spark",
  "docker",
  "snowflake",
  "bigquery",
  "airflow",
  "redshift",
  "postgres",
  "databricks",
  "dagster",
  "dbt-cloud",
] as const;
const MOCK_SERVICE_LABELS: Record<(typeof MOCK_SERVICE_TYPES)[number], string> =
  {
    trino: "Trino",
    clickhouse: "ClickHouse",
    polaris: "Apache Polaris",
    kafka: "Apache Kafka",
    s3: "S3 / MinIO",
    flink: "Apache Flink",
    spark: "Apache Spark",
    docker: "Docker",
    snowflake: "Snowflake",
    bigquery: "BigQuery",
    airflow: "Apache Airflow",
    redshift: "Amazon Redshift",
    postgres: "PostgreSQL",
    databricks: "Databricks",
    dagster: "Dagster",
    "dbt-cloud": "dbt Cloud",
  };

const connectionSchema = z.object({
  serviceType: z.enum(MOCK_SERVICE_TYPES).default("snowflake"),
  preset: z.enum(["realistic", "empty", "incident"]).default("realistic"),
  health: z.enum(["healthy", "warning", "unavailable"]).default("healthy"),
  latencyMs: z.coerce.number().int().min(0).max(2000).default(0),
});

type RecordRow = {
  id: string;
  name: string;
  status: string;
  owner: string;
  updatedAt: string;
};
type Message = {
  topic: string;
  partition: number;
  offset: string;
  timestamp: number;
  key: string;
  value: string;
};
type ObjectRow = {
  bucket: string;
  key: string;
  body: string;
  contentType: string;
  updatedAt: string;
};
type Job = {
  id: string;
  name: string;
  state: string;
  startedAt: string;
  durationMs: number;
};
type MockState = {
  records: RecordRow[];
  messages: Message[];
  objects: ObjectRow[];
  jobs: Job[];
  values: Array<{ key: string; value: string; updatedAt: string }>;
  logs: Array<{ timestamp: string; stream: string; line: string }>;
  sequence: number;
};

const states = new Map<string, MockState>();

function seededState(scenario: "commerce" | "empty", now: Date): MockState {
  if (scenario === "empty")
    return {
      records: [],
      messages: [],
      objects: [],
      jobs: [],
      values: [],
      logs: [],
      sequence: 1,
    };
  const iso = now.toISOString();
  const base = now.getTime();
  return {
    records: [
      {
        id: "cus_101",
        name: "Acme Labs",
        status: "active",
        owner: "Maya",
        updatedAt: iso,
      },
      {
        id: "cus_102",
        name: "Northstar",
        status: "trial",
        owner: "Leo",
        updatedAt: iso,
      },
      {
        id: "cus_103",
        name: "Paper Street",
        status: "paused",
        owner: "Inez",
        updatedAt: iso,
      },
    ],
    messages: [
      {
        topic: "orders.created",
        partition: 0,
        offset: "42",
        timestamp: base - 12_000,
        key: "ord_9001",
        value: JSON.stringify({ total: 129.5, currency: "USD" }),
      },
      {
        topic: "orders.created",
        partition: 1,
        offset: "18",
        timestamp: base - 5_000,
        key: "ord_9002",
        value: JSON.stringify({ total: 84, currency: "EUR" }),
      },
      {
        topic: "customers.updated",
        partition: 0,
        offset: "7",
        timestamp: base - 2_000,
        key: "cus_101",
        value: JSON.stringify({ plan: "growth" }),
      },
    ],
    objects: [
      {
        bucket: "analytics",
        key: "exports/customers.csv",
        body: Buffer.from(
          "id,name,status\ncus_101,Acme Labs,active\n",
        ).toString("base64"),
        contentType: "text/csv",
        updatedAt: iso,
      },
      {
        bucket: "analytics",
        key: "events/latest.json",
        body: Buffer.from(
          JSON.stringify({ event: "order.created", id: "ord_9002" }, null, 2),
        ).toString("base64"),
        contentType: "application/json",
        updatedAt: iso,
      },
      {
        bucket: "uploads",
        key: "readme.txt",
        body: Buffer.from("This is safe mock data.\n").toString("base64"),
        contentType: "text/plain",
        updatedAt: iso,
      },
    ],
    jobs: [
      {
        id: "run_301",
        name: "daily_customer_rollup",
        state: "success",
        startedAt: new Date(base - 3_600_000).toISOString(),
        durationMs: 42_810,
      },
      {
        id: "run_302",
        name: "sync_orders",
        state: "running",
        startedAt: new Date(base - 48_000).toISOString(),
        durationMs: 48_000,
      },
      {
        id: "run_303",
        name: "quality_checks",
        state: "failed",
        startedAt: new Date(base - 7_200_000).toISOString(),
        durationMs: 9_442,
      },
    ],
    values: [
      { key: "feature.checkout_v2", value: "true", updatedAt: iso },
      { key: "pipeline.batch_size", value: "500", updatedAt: iso },
    ],
    logs: [
      {
        timestamp: new Date(base - 8_000).toISOString(),
        stream: "stdout",
        line: "Mock worker started",
      },
      {
        timestamp: new Date(base - 4_000).toISOString(),
        stream: "stdout",
        line: "Processed 128 records",
      },
      {
        timestamp: new Date(base - 1_000).toISOString(),
        stream: "stderr",
        line: "Example warning: retry scheduled",
      },
    ],
    sequence: 1000,
  };
}

const pageInput = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.coerce.number().int().min(0).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
function page<T>(items: T[], input: unknown) {
  const parsed = pageInput.parse(input);
  const offset = parsed.cursor ?? parsed.offset ?? 0;
  const selected = items.slice(offset, offset + parsed.limit);
  return {
    items: selected,
    nextCursor:
      offset + selected.length < items.length
        ? String(offset + selected.length)
        : undefined,
  };
}

const action = (id: string, title: string, description: string) => ({
  id,
  authorization: "execute" as const,
  view: { kind: "action-form" as const, title, description },
});

export const mockAdapter = defineAdapter({
  id: "mock",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "mock",
    name: "Mock Service",
    category: "Development",
    description:
      "Run any supported service locally with realistic, mutable sample data.",
    icon: "mock",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "serviceType",
      label: "Service type",
      type: "select",
      required: true,
      options: MOCK_SERVICE_TYPES.map((value) => ({
        label: MOCK_SERVICE_LABELS[value],
        value,
      })),
    },
    {
      id: "preset",
      label: "Preset",
      type: "select",
      options: [
        { label: "Realistic data", value: "realistic" },
        { label: "Empty service", value: "empty" },
        { label: "Active incident", value: "incident" },
      ],
    },
    {
      id: "health",
      label: "Simulated health",
      type: "select",
      options: [
        { label: "Healthy", value: "healthy" },
        { label: "Warning", value: "warning" },
        { label: "Unavailable", value: "unavailable" },
      ],
    },
    {
      id: "latencyMs",
      label: "Simulated latency (ms)",
      type: "number",
      placeholder: "0",
    },
  ],
  secretPaths: [],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Mock environment" },
    },
    {
      id: "records",
      authorization: "inspect",
      supportsPagination: true,
      maxPageSize: 100,
      view: {
        kind: "record-list",
        title: "Mutable records",
        detail: "record-detail",
        idField: "id",
      },
    },
    {
      id: "record-detail",
      authorization: "inspect",
      view: { kind: "record-detail", title: "Record details" },
    },
    action(
      "create-record",
      "Create record",
      '{"name":"New customer","status":"active","owner":"Maya"}',
    ),
    action(
      "update-record",
      "Update record",
      '{"id":"cus_101","status":"paused"}',
    ),
    action("delete-record", "Delete record", '{"id":"cus_101"}'),
    {
      id: "query",
      authorization: "execute",
      view: { kind: "query", title: "Mock SQL", dialect: "SQL" },
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
      id: "metrics",
      authorization: "inspect",
      view: { kind: "service-info", title: "Metrics" },
    },
    {
      id: "running-queries",
      authorization: "inspect",
      view: { kind: "record-list", title: "Running queries" },
    },
    {
      id: "buckets",
      authorization: "inspect",
      view: { kind: "object-browser", title: "Mock object storage" },
    },
    {
      id: "objects",
      authorization: "inspect",
      view: { kind: "record-list", title: "Objects" },
    },
    {
      id: "object-get",
      authorization: "inspect",
      view: { kind: "record-detail", title: "Object preview" },
    },
    action(
      "object-put",
      "Upload object",
      '{"bucket":"uploads","key":"note.txt","body":"aGVsbG8="}',
    ),
    action(
      "object-delete",
      "Delete objects",
      '{"bucket":"uploads","keys":["note.txt"]}',
    ),
    {
      id: "topics",
      authorization: "inspect",
      view: { kind: "topic-browser", title: "Topics" },
    },
    {
      id: "messages",
      authorization: "inspect",
      view: { kind: "message-browser", title: "Mock messages" },
    },
    {
      id: "consumer-groups",
      authorization: "inspect",
      view: { kind: "consumer-groups", title: "Consumer groups" },
    },
    action(
      "produce-message",
      "Produce message",
      '{"topic":"orders.created","key":"ord_9003","value":"{\\"total\\":42}"}',
    ),
    {
      id: "jobs",
      authorization: "inspect",
      view: {
        kind: "job-browser",
        title: "Mock jobs",
        detail: "job-detail",
        idField: "id",
      },
    },
    {
      id: "job-detail",
      authorization: "inspect",
      view: { kind: "record-detail", title: "Job details" },
    },
    action(
      "job-action",
      "Change job state",
      '{"id":"run_302","state":"success"}',
    ),
    {
      id: "key-values",
      authorization: "inspect",
      view: { kind: "key-value-browser", title: "Key-value data" },
    },
    action(
      "put-key-value",
      "Put key-value",
      '{"key":"feature.demo","value":"true"}',
    ),
    action("delete-key-value", "Delete key-value", '{"key":"feature.demo"}'),
    {
      id: "logs",
      authorization: "inspect",
      view: { kind: "log-stream", title: "Mock logs" },
    },
    action(
      "append-log",
      "Append log line",
      '{"stream":"stdout","line":"Hello from the mock"}',
    ),
    action(
      "reset-data",
      "Reset mock data",
      "Reset this service to its selected preset.",
    ),
  ],
  create(context, connection) {
    const clock = context.now ?? (() => new Date());
    const scenario = connection.preset === "empty" ? "empty" : "commerce";
    const stateKey = `${connection.serviceType}:${connection.preset}`;
    const current = () => {
      let value = states.get(stateKey);
      if (!value) {
        value = seededState(scenario, clock());
        states.set(stateKey, value);
      }
      return value;
    };
    const wait = () =>
      connection.latencyMs
        ? new Promise<void>((resolve) =>
            setTimeout(resolve, connection.latencyMs),
          )
        : Promise.resolve();
    const logged = (line: string, stream = "stdout") =>
      current().logs.push({ timestamp: clock().toISOString(), stream, line });

    return {
      async health() {
        await wait();
        return {
          status: connection.health,
          checkedAt: clock().toISOString(),
          latencyMs: connection.latencyMs,
          detail:
            connection.health === "healthy"
              ? "Local mock is ready"
              : `Simulated ${connection.health} state`,
        };
      },
      async execute(operationId, input) {
        await wait();
        const state = current();
        if (operationId === "service-info")
          return {
            items: [
              { label: "Service type", value: connection.serviceType },
              { label: "Preset", value: connection.preset },
              { label: "Persistence", value: "In memory until server restart" },
              { label: "Records", value: String(state.records.length) },
            ],
          };
        if (operationId === "records") return page(state.records, input);
        if (operationId === "record-detail") {
          const { id } = z.object({ id: z.string() }).parse(input);
          const found = state.records.find((row) => row.id === id);
          if (!found) throw new Error(`Mock record not found: ${id}`);
          return { items: [found] };
        }
        if (operationId === "create-record") {
          const parsed = z
            .object({
              name: z.string().min(1),
              status: z.string().default("active"),
              owner: z.string().default("Unassigned"),
            })
            .parse(input);
          const row = {
            id: `cus_${state.sequence++}`,
            ...parsed,
            updatedAt: clock().toISOString(),
          };
          state.records.push(row);
          logged(`Created record ${row.id}`);
          return row;
        }
        if (operationId === "update-record") {
          const parsed = z
            .object({
              id: z.string(),
              name: z.string().optional(),
              status: z.string().optional(),
              owner: z.string().optional(),
            })
            .parse(input);
          const row = state.records.find((item) => item.id === parsed.id);
          if (!row) throw new Error(`Mock record not found: ${parsed.id}`);
          Object.assign(row, parsed, { updatedAt: clock().toISOString() });
          logged(`Updated record ${row.id}`);
          return row;
        }
        if (operationId === "delete-record") {
          const { id } = z.object({ id: z.string() }).parse(input);
          const before = state.records.length;
          state.records = state.records.filter((row) => row.id !== id);
          if (state.records.length === before)
            throw new Error(`Mock record not found: ${id}`);
          logged(`Deleted record ${id}`);
          return { deleted: id };
        }
        if (operationId === "query") {
          const { sql } = z.object({ sql: z.string().min(1) }).parse(input);
          if (/\b(error|fail)\b/i.test(sql))
            throw new Error("Simulated query failure requested by SQL text");
          return {
            items: state.records.map((row) => [
              row.id,
              row.name,
              row.status,
              row.owner,
              row.updatedAt,
            ]),
            columns: ["id", "name", "status", "owner", "updated_at"],
          };
        }
        if (operationId === "schemas")
          return {
            items: [
              ["mock", "commerce"],
              ["mock", "operations"],
            ],
            columns: ["catalog", "schema"],
          };
        if (operationId === "tables")
          return {
            items: [
              ["mock", "commerce", "customers"],
              ["mock", "commerce", "orders"],
              ["mock", "operations", "jobs"],
            ],
            columns: ["catalog", "schema", "table"],
          };
        if (operationId === "metrics")
          return {
            items: [
              { label: "Records", value: state.records.length },
              { label: "Messages", value: state.messages.length },
              { label: "Objects", value: state.objects.length },
              { label: "Jobs", value: state.jobs.length },
            ],
          };
        if (operationId === "running-queries")
          return {
            items: [
              [
                "mock-query-1",
                "RUNNING",
                "SELECT * FROM mock.commerce.customers",
              ],
            ],
            columns: ["query_id", "state", "sql"],
          };
        if (operationId === "buckets")
          return {
            items: [...new Set(state.objects.map((item) => item.bucket))].map(
              (name) => ({
                name,
                createdAt: state.objects.find((item) => item.bucket === name)
                  ?.updatedAt,
              }),
            ),
          };
        if (operationId === "objects") {
          const parsed = z
            .object({
              bucket: z.string(),
              prefix: z.string().default(""),
              limit: z.coerce.number().int().default(100),
              cursor: z.coerce.number().int().optional(),
            })
            .parse(input);
          const folders = new Set<string>();
          const objects = state.objects
            .filter(
              (item) =>
                item.bucket === parsed.bucket &&
                item.key.startsWith(parsed.prefix),
            )
            .filter((item) => {
              const remainder = item.key.slice(parsed.prefix.length);
              const slash = remainder.indexOf("/");
              if (slash >= 0) {
                folders.add(remainder.slice(0, slash + 1));
                return false;
              }
              return true;
            })
            .map((item) => ({
              key: item.key,
              name: item.key.slice(parsed.prefix.length),
              size: Buffer.from(item.body, "base64").length,
              updatedAt: item.updatedAt,
            }));
          return { ...page(objects, parsed), folders: [...folders] };
        }
        if (operationId === "object-get") {
          const { bucket, key } = z
            .object({ bucket: z.string(), key: z.string() })
            .parse(input);
          const item = state.objects.find(
            (row) => row.bucket === bucket && row.key === key,
          );
          if (!item) throw new Error(`Mock object not found: ${bucket}/${key}`);
          return {
            key,
            size: Buffer.from(item.body, "base64").length,
            contentType: item.contentType,
            updatedAt: item.updatedAt,
            preview: item.body,
            encoding: "base64",
          };
        }
        if (operationId === "object-put") {
          const parsed = z
            .object({
              bucket: z.string(),
              key: z.string(),
              body: z.string(),
              contentType: z.string().default("application/octet-stream"),
            })
            .parse(input);
          const item = { ...parsed, updatedAt: clock().toISOString() };
          state.objects = state.objects.filter(
            (row) => row.bucket !== parsed.bucket || row.key !== parsed.key,
          );
          state.objects.push(item);
          logged(`Put object ${parsed.bucket}/${parsed.key}`);
          return { key: parsed.key };
        }
        if (operationId === "object-delete") {
          const parsed = z
            .object({ bucket: z.string(), keys: z.array(z.string()) })
            .parse(input);
          state.objects = state.objects.filter(
            (row) =>
              row.bucket !== parsed.bucket || !parsed.keys.includes(row.key),
          );
          logged(`Deleted ${parsed.keys.length} object(s)`);
          return { deleted: parsed.keys.length };
        }
        if (operationId === "topics")
          return page(
            [...new Set(state.messages.map((item) => item.topic))].map(
              (name) => ({ name, partitions: 2 }),
            ),
            input,
          );
        if (operationId === "messages") {
          const parsed = z
            .object({
              topic: z.string(),
              limit: z.coerce.number().int().default(50),
            })
            .parse(input);
          return {
            items: state.messages
              .filter((item) => item.topic === parsed.topic)
              .slice(-parsed.limit)
              .reverse()
              .map(({ topic: _topic, ...item }) => item),
          };
        }
        if (operationId === "consumer-groups")
          return {
            items: [
              {
                groupId: "mock-analytics",
                state: "Stable",
                members: 2,
                lag: 4,
              },
              { groupId: "mock-sink", state: "Empty", members: 0, lag: 0 },
            ],
          };
        if (operationId === "produce-message") {
          const parsed = z
            .object({
              topic: z.string(),
              key: z.string().default(""),
              value: z.string(),
              partition: z.coerce.number().int().min(0).default(0),
            })
            .parse(input);
          const message = {
            ...parsed,
            offset: String(state.sequence++),
            timestamp: clock().getTime(),
          };
          state.messages.push(message);
          logged(`Produced message to ${parsed.topic}`);
          return message;
        }
        if (operationId === "jobs") return page(state.jobs, input);
        if (operationId === "job-detail") {
          const { id } = z.object({ id: z.string() }).parse(input);
          const job = state.jobs.find((item) => item.id === id);
          if (!job) throw new Error(`Mock job not found: ${id}`);
          return {
            items: Object.entries(job).map(([label, value]) => ({
              label,
              value,
            })),
          };
        }
        if (operationId === "job-action") {
          const parsed = z
            .object({
              id: z.string(),
              state: z.enum([
                "queued",
                "running",
                "success",
                "failed",
                "cancelled",
              ]),
            })
            .parse(input);
          const job = state.jobs.find((item) => item.id === parsed.id);
          if (!job) throw new Error(`Mock job not found: ${parsed.id}`);
          job.state = parsed.state;
          logged(`Changed job ${job.id} to ${job.state}`);
          return job;
        }
        if (operationId === "key-values") return page(state.values, input);
        if (operationId === "put-key-value") {
          const parsed = z
            .object({ key: z.string(), value: z.string() })
            .parse(input);
          state.values = state.values.filter((item) => item.key !== parsed.key);
          const item = { ...parsed, updatedAt: clock().toISOString() };
          state.values.push(item);
          logged(`Put key ${parsed.key}`);
          return item;
        }
        if (operationId === "delete-key-value") {
          const { key } = z.object({ key: z.string() }).parse(input);
          state.values = state.values.filter((item) => item.key !== key);
          logged(`Deleted key ${key}`);
          return { deleted: key };
        }
        if (operationId === "logs") return { items: state.logs.slice(-200) };
        if (operationId === "append-log") {
          const parsed = z
            .object({
              stream: z.enum(["stdout", "stderr"]).default("stdout"),
              line: z.string(),
            })
            .parse(input);
          logged(parsed.line, parsed.stream);
          return state.logs.at(-1);
        }
        if (operationId === "reset-data") {
          const reset = seededState(scenario, clock());
          states.set(stateKey, reset);
          return { reset: true, preset: connection.preset };
        }
        throw new Error(`Unsupported mock operation: ${operationId}`);
      },
    };
  },
});

export function resetMockWorkspaces() {
  states.clear();
}

export default mockAdapter;
