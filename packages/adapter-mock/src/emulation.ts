import type {
  AdapterContext,
  AdapterDefinition,
  AdapterInstance,
} from "@northgraindata/dsui-adapter-sdk";

type Row = Record<string, unknown>;
type EmulatedState = {
  rows: Row[];
  messages: Row[];
  objects: Array<{
    bucket: string;
    key: string;
    body: string;
    contentType: string;
    updatedAt: string;
  }>;
  jobs: Row[];
  events: Row[];
  sequence: number;
};

const emulatedStates = new Map<string, EmulatedState>();

function seed(now: Date, preset: EmulatorOptions["preset"]): EmulatedState {
  const at = now.toISOString();
  const state: EmulatedState = {
    rows: [
      {
        id: "row_101",
        name: "Acme Labs",
        status: "active",
        amount: 129.5,
        updated_at: at,
      },
      {
        id: "row_102",
        name: "Northstar",
        status: "trial",
        amount: 84,
        updated_at: at,
      },
      {
        id: "row_103",
        name: "Paper Street",
        status: "paused",
        amount: 42.25,
        updated_at: at,
      },
    ],
    messages: [
      {
        topic: "orders.created",
        partition: 0,
        offset: "42",
        timestamp: now.getTime() - 5000,
        key: "ord_9001",
        value: JSON.stringify({ total: 129.5 }),
      },
      {
        topic: "customers.updated",
        partition: 0,
        offset: "7",
        timestamp: now.getTime() - 2000,
        key: "cus_101",
        value: JSON.stringify({ plan: "growth" }),
      },
    ],
    objects: [
      {
        bucket: "mock-analytics",
        key: "exports/customers.csv",
        body: Buffer.from("id,name\nrow_101,Acme Labs\n").toString("base64"),
        contentType: "text/csv",
        updatedAt: at,
      },
    ],
    jobs: [
      {
        id: "job_301",
        name: "daily_rollup",
        state: "success",
        started_at: at,
        duration_ms: 42810,
      },
      {
        id: "job_302",
        name: "sync_orders",
        state: "running",
        started_at: at,
        duration_ms: 48000,
      },
    ],
    events: [],
    sequence: 1000,
  };
  if (preset === "empty") {
    state.rows = [];
    state.messages = [];
    state.objects = [];
    state.jobs = [];
  }
  if (preset === "incident") {
    state.jobs = state.jobs.map((job, index) => ({
      ...job,
      state: index === 0 ? "failed" : "running",
    }));
    state.events.push({
      id: "event_incident",
      operation: "health-check",
      status: "warning",
      input: { reason: "Simulated upstream timeout" },
      created_at: at,
    });
  }
  return state;
}

export type EmulatorOptions = {
  preset?: "realistic" | "empty" | "incident";
  health?: "healthy" | "warning" | "unavailable";
  latencyMs?: number;
};

function page(items: unknown[], input: unknown) {
  const source = (input ?? {}) as {
    limit?: unknown;
    cursor?: unknown;
    offset?: unknown;
  };
  const limit = Math.max(1, Math.min(100, Number(source.limit ?? 50) || 50));
  const offset = Math.max(0, Number(source.cursor ?? source.offset ?? 0) || 0);
  const selected = items.slice(offset, offset + limit);
  return {
    items: selected,
    nextCursor:
      offset + selected.length < items.length
        ? String(offset + selected.length)
        : undefined,
  };
}

function mutationResult(
  state: EmulatedState,
  operationId: string,
  input: unknown,
  now: Date,
) {
  const event = {
    id: `event_${state.sequence++}`,
    operation: operationId,
    status: "accepted",
    input,
    created_at: now.toISOString(),
  };
  state.events.unshift(event);
  return event;
}

function clickhouseExplorerResult(
  operationId: string,
  input: unknown,
  now: Date,
): { items: unknown[]; columns?: string[] } | undefined {
  const source = (input ?? {}) as {
    database?: unknown;
    table?: unknown;
    limit?: unknown;
    offset?: unknown;
  };
  const database = String(source.database ?? "analytics");
  const table = String(source.table ?? "events");
  if (operationId === "schemas")
    return {
      items: [
        ["analytics", "Atomic"],
        ["default", "Atomic"],
        ["observability", "Atomic"],
        ["system", "Atomic"],
      ],
      columns: ["database", "engine"],
    };
  if (operationId === "database-objects") {
    const objects: Record<string, unknown[][]> = {
      analytics: [
        ["analytics", "events", "table", "MergeTree", 240, 49_152],
        ["analytics", "customers", "table", "ReplacingMergeTree", 84, 24_576],
        [
          "analytics",
          "daily_revenue",
          "materialized-view",
          "MaterializedView",
          30,
          8192,
        ],
        ["analytics", "active_customers", "view", "View", null, null],
      ],
      default: [
        ["default", "numbers_demo", "table", "MergeTree", 10_000, 65_536],
      ],
      observability: [
        [
          "observability",
          "otel_logs",
          "table",
          "MergeTree",
          125_840,
          12_582_912,
        ],
        [
          "observability",
          "otel_traces",
          "table",
          "MergeTree",
          42_300,
          7_340_032,
        ],
      ],
      system: [
        ["system", "query_log", "table", "SystemLog", 18_420, 4_194_304],
        ["system", "parts", "table", "SystemParts", 128, 262_144],
      ],
    };
    return {
      items: objects[database] ?? [],
      columns: [
        "database",
        "name",
        "object_type",
        "engine",
        "total_rows",
        "total_bytes",
      ],
    };
  }
  if (operationId === "table-overview")
    return {
      items: [
        [
          database,
          table,
          table === "customers" ? "ReplacingMergeTree" : "MergeTree",
          "e7f4d850-1b2c-4c6d-8e91-918b3b752afd",
          "toYYYYMM(occurred_at)",
          "(occurred_at, event_id)",
          "event_id",
          "",
          table === "events" ? 240 : 84,
          table === "events" ? 49_152 : 24_576,
          table === "events" ? 98_304 : 41_984,
          4,
          4,
          now.toISOString(),
          "Realistic ClickHouse mock table",
        ],
      ],
      columns: [
        "database",
        "name",
        "engine",
        "uuid",
        "partition_key",
        "sorting_key",
        "primary_key",
        "sampling_key",
        "total_rows",
        "total_bytes",
        "total_bytes_uncompressed",
        "parts",
        "active_parts",
        "metadata_modification_time",
        "comment",
      ],
    };
  if (operationId === "table-columns")
    return {
      items: [
        [
          "event_id",
          "UInt64",
          1,
          "",
          "",
          "Delta, ZSTD(1)",
          "",
          "Event identifier",
        ],
        [
          "event_type",
          "LowCardinality(String)",
          2,
          "",
          "",
          "ZSTD(1)",
          "",
          "Event name",
        ],
        [
          "occurred_at",
          "DateTime64(3, 'UTC')",
          3,
          "",
          "",
          "DoubleDelta, ZSTD(1)",
          "",
          "Event time",
        ],
        [
          "payload",
          "JSON",
          4,
          "DEFAULT",
          "{}",
          "ZSTD(3)",
          "",
          "Event properties",
        ],
      ],
      columns: [
        "name",
        "type",
        "position",
        "default_kind",
        "default_expression",
        "compression_codec",
        "ttl_expression",
        "comment",
      ],
    };
  if (operationId === "table-preview") {
    const limit = Math.max(
      1,
      Math.min(1000, Number(source.limit ?? 100) || 100),
    );
    const offset = Math.max(0, Number(source.offset ?? 0) || 0);
    const rows = Array.from({ length: 240 }, (_, index) => [
      index + 1,
      ["page.viewed", "cart.updated", "checkout.completed"][index % 3],
      new Date(now.getTime() - index * 60_000).toISOString(),
      JSON.stringify({
        session_id: `ses_${1000 + index}`,
        amount: (index % 17) * 12.5,
      }),
    ]);
    return {
      items: rows.slice(offset, offset + limit),
      columns: ["event_id", "event_type", "occurred_at", "payload"],
    };
  }
  if (operationId === "table-ddl")
    return {
      items: [
        [
          `CREATE TABLE ${database}.${table}\n(\n    event_id UInt64 CODEC(Delta, ZSTD(1)),\n    event_type LowCardinality(String),\n    occurred_at DateTime64(3, 'UTC') CODEC(DoubleDelta, ZSTD(1)),\n    payload JSON CODEC(ZSTD(3))\n)\nENGINE = MergeTree\nPARTITION BY toYYYYMM(occurred_at)\nORDER BY (occurred_at, event_id)`,
        ],
      ],
      columns: ["statement"],
    };
  if (operationId === "table-parts")
    return {
      items: [0, 1, 2, 3].map((index) => [
        "202609",
        `202609_${index + 1}_${index + 1}_0`,
        60,
        12_288,
        2,
        "default",
        new Date(now.getTime() - index * 3_600_000).toISOString(),
      ]),
      columns: [
        "partition",
        "name",
        "rows",
        "bytes_on_disk",
        "marks",
        "disk_name",
        "modification_time",
      ],
    };
  return undefined;
}

function realisticRows(
  adapterId: string,
  operationId: string,
  state: EmulatedState,
  now: Date,
  preset: EmulatorOptions["preset"],
): Row[] | undefined {
  if (preset === "empty") return [];
  const at = now.toISOString();
  if (adapterId === "airflow") {
    const fixtures: Record<string, Row[]> = {
      dags: [
        {
          id: "customer_daily",
          dag_id: "customer_daily",
          is_paused: false,
          is_active: true,
          owners: ["data-platform"],
          schedule_interval: "0 6 * * *",
        },
        {
          id: "orders_hourly",
          dag_id: "orders_hourly",
          is_paused: false,
          is_active: true,
          owners: ["analytics"],
          schedule_interval: "@hourly",
        },
      ],
      "dag-runs": state.jobs.map((job) => ({
        ...job,
        dag_id: job.name,
        dag_run_id: job.id,
        logical_date: job.started_at,
      })),
      "task-instances": [
        {
          id: "extract",
          task_id: "extract",
          dag_id: "customer_daily",
          state: "success",
          start_date: at,
          duration: 12.4,
        },
        {
          id: "transform",
          task_id: "transform",
          dag_id: "customer_daily",
          state: "running",
          start_date: at,
          duration: 8.1,
        },
        {
          id: "publish",
          task_id: "publish",
          dag_id: "customer_daily",
          state: "queued",
          start_date: null,
          duration: null,
        },
      ],
      assets: [
        {
          id: "warehouse.customers",
          uri: "warehouse://customers",
          group: "analytics",
          last_update: at,
        },
      ],
      "asset-aliases": [
        {
          id: "customers_latest",
          name: "customers_latest",
          asset: "warehouse.customers",
        },
      ],
      "asset-events": [
        {
          id: "asset-event-1",
          asset_uri: "warehouse://customers",
          timestamp: at,
          source_dag_id: "customer_daily",
        },
      ],
      pools: [
        {
          id: "default_pool",
          name: "default_pool",
          slots: 128,
          occupied_slots: 7,
          queued_slots: 2,
        },
      ],
      variables: [
        {
          id: "environment",
          key: "environment",
          value: "development",
          description: "Mock variable",
        },
      ],
      connections: [
        {
          id: "warehouse_default",
          connection_id: "warehouse_default",
          conn_type: "postgres",
          host: "warehouse.internal",
        },
      ],
      providers: [
        {
          id: "apache-airflow-providers-postgres",
          package_name: "apache-airflow-providers-postgres",
          version: "6.2.0",
        },
      ],
      plugins: [
        { id: "lineage", name: "lineage", hooks: ["on_task_instance_success"] },
      ],
      "import-errors": [],
      "event-logs": state.events,
      jobs: state.jobs,
      "dag-warnings": [],
      tags: [
        { id: "analytics", name: "analytics" },
        { id: "hourly", name: "hourly" },
      ],
      backfills: [
        {
          id: "backfill_1",
          dag_id: "customer_daily",
          state: "running",
          from_date: at,
          to_date: at,
        },
      ],
      "dag-versions": [
        {
          id: "customer_daily:4",
          dag_id: "customer_daily",
          version_number: 4,
          created_at: at,
        },
      ],
      users: [
        {
          id: "admin",
          username: "admin",
          first_name: "Data",
          last_name: "Admin",
          active: true,
        },
      ],
      roles: [
        { id: "Admin", name: "Admin" },
        { id: "Viewer", name: "Viewer" },
      ],
      permissions: [
        { id: "can_read:DAG", action: "can_read", resource: "DAG" },
      ],
    };
    return fixtures[operationId];
  }
  if (adapterId === "dbt-cloud") {
    const fixtures: Record<string, Row[]> = {
      projects: [{ id: 101, name: "Analytics", account_id: 1, created_at: at }],
      environments: [
        {
          id: 201,
          name: "Production",
          type: "deployment",
          project_id: 101,
          state: 1,
        },
      ],
      jobs: [
        {
          id: 301,
          name: "Production build",
          project_id: 101,
          environment_id: 201,
          execute_steps: ["dbt build"],
        },
      ],
      runs: state.jobs.map((job) => ({
        ...job,
        job_id: 301,
        status_humanized: job.state,
        git_branch: "main",
      })),
      connections: [
        { id: 401, name: "Mock warehouse", type: "snowflake", state: 1 },
      ],
      repositories: [
        {
          id: 501,
          name: "analytics",
          remote_url: "git@github.com:example/analytics.git",
          project_id: 101,
        },
      ],
      users: [
        {
          id: 601,
          email: "analyst@example.com",
          first_name: "Ada",
          last_name: "Lovelace",
          is_active: true,
        },
      ],
      invites: [
        { id: 701, email: "new-analyst@example.com", state: "pending" },
      ],
      licenses: [
        { id: 801, license_type: "developer", state: 1, user_id: 601 },
      ],
      permissions: [
        {
          id: 901,
          user_id: 601,
          permission_set: "account_admin",
          project_id: null,
        },
      ],
      notifications: [
        { id: 1001, user_id: 601, type: 1, on_failure: [301], on_success: [] },
      ],
      "run-artifacts": [
        { id: "manifest.json", path: "manifest.json", run_id: "job_301" },
        { id: "run_results.json", path: "run_results.json", run_id: "job_301" },
      ],
    };
    return fixtures[operationId];
  }
  if (adapterId === "dagster") {
    const fixtures: Record<string, Row[]> = {
      workspace: [
        {
          id: "analytics",
          name: "analytics",
          loadStatus: "LOADED",
          updatedTimestamp: now.getTime() / 1000,
        },
      ],
      jobs: [
        {
          id: "daily_assets",
          name: "daily_assets",
          isJob: true,
          graphName: "daily_assets",
          description: "Materialize daily analytics",
        },
      ],
      runs: state.jobs.map((job) => ({
        ...job,
        runId: job.id,
        jobName: job.name,
        status: String(job.state).toUpperCase(),
      })),
      assets: [
        {
          id: "asset_customers",
          key: { path: ["warehouse", "customers"] },
          definition: {
            groupName: "analytics",
            computeKind: "dbt",
            isExecutable: true,
          },
        },
      ],
      schedules: [
        {
          id: "daily_schedule",
          name: "daily_schedule",
          cronSchedule: "0 6 * * *",
          scheduleState: { status: "RUNNING" },
          pipelineName: "daily_assets",
        },
      ],
      sensors: [
        {
          id: "orders_sensor",
          name: "orders_sensor",
          sensorType: "STANDARD",
          sensorState: { status: "RUNNING" },
        },
      ],
      backfills: [
        {
          id: "bf_1",
          backfillId: "bf_1",
          status: "REQUESTED",
          timestamp: now.getTime() / 1000,
          partitionNames: ["2026-08-30"],
        },
      ],
      daemons: [
        {
          id: "SCHEDULER",
          daemonType: "SCHEDULER",
          healthy: true,
          required: true,
          lastHeartbeatTime: now.getTime() / 1000,
        },
      ],
      resources: [
        {
          id: "warehouse",
          name: "warehouse",
          description: "Mock warehouse resource",
          resourceType: "SnowflakeResource",
        },
      ],
    };
    return fixtures[operationId];
  }
  const common: Record<string, Row[]> = {
    datasets: [
      { id: "analytics", datasetId: "analytics", location: "US", created: at },
      { id: "raw", datasetId: "raw", location: "US", created: at },
    ],
    catalogs: [
      { id: "main", name: "main", type: "MANAGED_CATALOG" },
      { id: "samples", name: "samples", type: "READ_ONLY" },
    ],
    routines: [
      {
        id: "normalize_email",
        name: "normalize_email",
        type: "SCALAR_FUNCTION",
        language: "SQL",
      },
    ],
    functions: [
      {
        id: "public.calculate_total",
        schema: "public",
        name: "calculate_total",
        result_type: "numeric",
      },
    ],
    "active-queries": [
      {
        id: "query_1",
        pid: 4217,
        user: "analytics",
        state: "active",
        query: "SELECT * FROM customers",
      },
    ],
    queries: [
      {
        id: "query_1",
        user: "analytics",
        state: "RUNNING",
        query: "SELECT * FROM customers",
        elapsed_ms: 842,
      },
    ],
    locks: [
      {
        id: "lock_1",
        relation: "orders",
        mode: "AccessShareLock",
        granted: true,
        pid: 4217,
      },
    ],
    "database-sizes": [
      { id: "analytics", database: "analytics", size: "4.2 GB" },
    ],
    storage: [
      {
        id: "analytics",
        database: "analytics",
        used_bytes: 4_509_715_456,
        max_bytes: 107_374_182_400,
      },
    ],
    workload: [
      {
        id: "analytics",
        queue: "analytics",
        running: 2,
        queued: 1,
        memory_percent: 38,
      },
    ],
    users: [
      { id: "analytics", name: "analytics", role: "developer", active: true },
    ],
    runs: state.jobs,
    pipelines: [
      {
        id: "pipeline_1",
        name: "bronze_to_silver",
        state: "IDLE",
        last_run: at,
      },
    ],
    clusters: [
      {
        id: "cluster_1",
        name: "Shared development",
        state: "RUNNING",
        workers: 2,
        runtime: "15.4 LTS",
      },
    ],
  };
  return common[operationId];
}

/**
 * Runs a real adapter's declared manifest against local mutable fixtures.
 * Unknown future capabilities still receive a renderer-shaped response.
 */
export function createAdapterEmulator(
  adapter: AdapterDefinition,
  serviceId: string,
  context: AdapterContext = {},
  options: EmulatorOptions = {},
): AdapterInstance {
  const now = context.now ?? (() => new Date());
  const preset = options.preset ?? "realistic";
  const key = `${adapter.id}:${serviceId}:${preset}`;
  const state = () => {
    let current = emulatedStates.get(key);
    if (!current) {
      current = seed(now(), preset);
      emulatedStates.set(key, current);
    }
    return current;
  };
  return {
    async health() {
      if (options.latencyMs)
        await new Promise((resolve) => setTimeout(resolve, options.latencyMs));
      return {
        status: options.health ?? "healthy",
        checkedAt: now().toISOString(),
        latencyMs: options.latencyMs ?? 0,
        detail: `Mocking ${adapter.metadata.name} locally · ${preset} preset`,
      };
    },
    async execute(operationId, input) {
      if (options.latencyMs)
        await new Promise((resolve) => setTimeout(resolve, options.latencyMs));
      const capability = adapter.capabilities.find(
        (item) => item.id === operationId,
      );
      if (!capability)
        throw new Error(
          `Unknown ${adapter.metadata.name} capability: ${operationId}`,
        );
      const current = state();
      const kind = capability.view.kind;

      if (operationId === "query") {
        const sql = String(
          (input as { sql?: unknown } | null)?.sql ?? "SELECT * FROM MOCK_DATA",
        );
        if (/\b(error|fail)\b/i.test(sql))
          throw new Error(`Simulated ${adapter.metadata.name} query failure`);
        if (/^\s*(insert|update|delete|merge|create|alter|drop)\b/i.test(sql)) {
          const event = mutationResult(current, "query-write", { sql }, now());
          if (/^\s*insert\b/i.test(sql))
            current.rows.push({
              id: `row_${current.sequence++}`,
              name: "Inserted by mock SQL",
              status: "active",
              amount: 1,
              updated_at: now().toISOString(),
            });
          if (/^\s*delete\b/i.test(sql)) current.rows.pop();
          return {
            items: [[event.id, "SUCCESS", 1]],
            columns: ["statement_id", "status", "rows_affected"],
          };
        }
        return {
          items: current.rows.map((row) => [
            row.id,
            row.name,
            row.status,
            row.amount,
            row.updated_at,
          ]),
          columns: ["ID", "NAME", "STATUS", "AMOUNT", "UPDATED_AT"],
        };
      }
      if (operationId === "service-info")
        return {
          items: [
            { label: "Service", value: adapter.metadata.name },
            { label: "Mode", value: "Mock" },
            { label: "Account", value: "DSUI_DEVELOPMENT" },
            { label: "Region", value: "local-1" },
          ],
        };
      if (operationId === "metrics" || operationId === "overview")
        return {
          items: [
            { label: "Records", value: current.rows.length },
            { label: "Jobs", value: current.jobs.length },
            { label: "Actions", value: current.events.length },
          ],
        };
      if (
        preset === "empty" &&
        capability.authorization === "inspect" &&
        operationId !== "service-info"
      )
        return { items: [] };
      if (adapter.id === "clickhouse") {
        const explorer = clickhouseExplorerResult(operationId, input, now());
        if (explorer) return explorer;
      }
      if (operationId === "databases" || operationId === "catalogs")
        return { items: [["MOCK_ANALYTICS"], ["MOCK_RAW"]], columns: ["name"] };
      if (operationId === "schemas")
        return {
          items: [
            ["MOCK_ANALYTICS", "PUBLIC"],
            ["MOCK_RAW", "LANDING"],
          ],
          columns: ["catalog", "schema"],
        };
      if (operationId === "tables")
        return {
          items: [
            ["MOCK_ANALYTICS", "PUBLIC", "CUSTOMERS"],
            ["MOCK_ANALYTICS", "PUBLIC", "ORDERS"],
            ["MOCK_RAW", "LANDING", "EVENTS"],
          ],
          columns: ["catalog", "schema", "table"],
        };
      if (operationId === "views")
        return {
          items: [
            ["ACTIVE_CUSTOMERS", "MOCK_ANALYTICS", "PUBLIC"],
            ["DAILY_REVENUE", "MOCK_ANALYTICS", "PUBLIC"],
          ],
          columns: ["name", "database", "schema"],
        };
      if (operationId === "warehouses" || operationId === "clusters")
        return {
          items: [
            {
              name: "COMPUTE_WH",
              state: "STARTED",
              size: "X-Small",
              running: 1,
            },
            { name: "ETL_WH", state: "SUSPENDED", size: "Small", running: 0 },
          ],
        };
      if (operationId === "query-history" || operationId === "history")
        return {
          items: [
            {
              query_id: "mock-query-1",
              user_name: "DSUI",
              warehouse_name: "COMPUTE_WH",
              execution_status: "SUCCESS",
              query_text: "SELECT * FROM CUSTOMERS",
              rows_produced: current.rows.length,
              bytes_scanned: 4096,
            },
          ],
        };
      if (operationId === "running-queries")
        return {
          items: [["mock-query-running", "RUNNING", "SELECT * FROM CUSTOMERS"]],
          columns: ["query_id", "state", "sql"],
        };
      const fixture = realisticRows(
        adapter.id,
        operationId,
        current,
        now(),
        preset,
      );
      if (fixture) return page(fixture, input);
      if (operationId === "topics")
        return page(
          [...new Set(current.messages.map((item) => String(item.topic)))].map(
            (name) => ({ name, partitions: 2 }),
          ),
          input,
        );
      if (operationId === "messages") {
        const topic = String(
          (input as { topic?: unknown } | null)?.topic ?? "orders.created",
        );
        return page(
          current.messages.filter((item) => item.topic === topic),
          input,
        );
      }
      if (operationId === "consumer-groups")
        return {
          items: [
            { groupId: "mock-analytics", state: "Stable", members: 2, lag: 4 },
          ],
        };
      if (operationId === "buckets")
        return {
          items: [...new Set(current.objects.map((item) => item.bucket))].map(
            (name) => ({
              name,
              createdAt: current.objects.find((item) => item.bucket === name)
                ?.updatedAt,
            }),
          ),
        };
      if (operationId === "objects") {
        const source = (input ?? {}) as { bucket?: unknown; prefix?: unknown };
        const bucket = String(source.bucket ?? "mock-analytics");
        const prefix = String(source.prefix ?? "");
        return {
          items: current.objects
            .filter(
              (item) => item.bucket === bucket && item.key.startsWith(prefix),
            )
            .map((item) => ({
              key: item.key,
              name: item.key.slice(prefix.length),
              size: Buffer.from(item.body, "base64").length,
              updatedAt: item.updatedAt,
            })),
          folders: [],
        };
      }
      if (operationId === "object-get") {
        const source = (input ?? {}) as { bucket?: unknown; key?: unknown };
        const item =
          current.objects.find(
            (row) => row.bucket === source.bucket && row.key === source.key,
          ) ?? current.objects[0];
        return item
          ? {
              key: item.key,
              contentType: item.contentType,
              updatedAt: item.updatedAt,
              size: Buffer.from(item.body, "base64").length,
              preview: item.body,
              encoding: "base64",
            }
          : {};
      }
      if (operationId === "logs")
        return {
          items: current.events.map((event) => ({
            timestamp: event.created_at,
            stream: "stdout",
            line: `${event.operation} ${event.status}`,
          })),
        };
      if (
        operationId === "tasks" ||
        operationId === "jobs" ||
        operationId === "dag-runs" ||
        kind === "job-browser"
      )
        return page(current.jobs, input);
      if (kind === "record-detail") {
        const id = String(
          (input as { id?: unknown } | null)?.id ??
            current.rows[0]?.id ??
            "mock",
        );
        const row = current.rows.find((item) => String(item.id) === id) ??
          current.rows[0] ?? { id, status: "mock" };
        return { items: [row] };
      }
      if (capability.authorization === "execute" || kind === "action-form") {
        const source = (input ?? {}) as Record<string, unknown>;
        if (
          /^(trigger|launch|run-job|retry)/.test(operationId) ||
          operationId === "materialize-asset"
        )
          current.jobs.unshift({
            id: `job_${current.sequence++}`,
            name: String(
              source.dagId ?? source.jobId ?? source.name ?? operationId,
            ),
            state: "running",
            started_at: now().toISOString(),
            duration_ms: 0,
          });
        if (/cancel|terminate/.test(operationId)) {
          const running = current.jobs.find((job) => job.state === "running");
          if (running) running.state = "cancelled";
        }
        if (operationId === "produce-message")
          current.messages.push({
            topic: String(source.topic ?? "orders.created"),
            partition: Number(source.partition ?? 0),
            offset: String(current.sequence++),
            timestamp: now().getTime(),
            key: String(source.key ?? "mock-key"),
            value: String(source.value ?? "{}"),
          });
        if (operationId === "create-topic")
          current.messages.push({
            topic: String(source.topic ?? source.name ?? "mock.topic"),
            partition: 0,
            offset: "0",
            timestamp: now().getTime(),
            key: "seed",
            value: "{}",
          });
        if (operationId === "object-put")
          current.objects.push({
            bucket: String(source.bucket ?? "mock-analytics"),
            key: String(source.key ?? `object-${current.sequence++}.json`),
            body: String(source.body ?? "e30="),
            contentType: String(source.contentType ?? "application/json"),
            updatedAt: now().toISOString(),
          });
        if (operationId === "object-delete") {
          const keys = Array.isArray(source.keys)
            ? source.keys.map(String)
            : [String(source.key ?? "")];
          current.objects = current.objects.filter(
            (item) =>
              item.bucket !== String(source.bucket) || !keys.includes(item.key),
          );
        }
        return mutationResult(current, operationId, input, now());
      }
      if (kind === "service-info")
        return {
          items: [
            { label: "Mode", value: "Mock" },
            { label: "Resource", value: capability.view.title },
            { label: "Status", value: "healthy", format: "status" },
          ],
        };
      return page(
        current.rows.map((row) => ({
          ...row,
          resource: capability.view.title,
        })),
        input,
      );
    },
  };
}

export function resetAdapterEmulators() {
  emulatedStates.clear();
}
