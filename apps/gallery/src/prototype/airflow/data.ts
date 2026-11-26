/*
 * Invented data for the design prototype, sized like a company's Airflow.
 * Fields are limited to what the Airflow REST API returns.
 */
import type { TaskState } from "../../../../../packages/adapter-airflow/src/states";

/** Task states; a DAG run uses only queued, running, success and failed. */
export type State = TaskState;

/** The prototype's fixed "now", so every time on screen agrees. */
export const NOW = new Date(2026, 10, 26, 14, 0);
const MINUTE = 60_000;
export const ago = (minutes: number) =>
  new Date(NOW.getTime() - minutes * MINUTE);

const two = (value: number) => String(value).padStart(2, "0");
export const clock = (date: Date) =>
  `${two(date.getHours())}:${two(date.getMinutes())}`;
const day = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const dayLabel = (date: Date) => {
  const days = Math.round(
    (new Date(NOW).setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : day(date);
};
export const stamp = (date: Date) =>
  date.getTime() > 0 ? `${dayLabel(date)} ${clock(date)}` : "Never";
export const minutesText = (minutes: number) =>
  minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

/** Repeatable pseudo-random numbers, so screenshots do not change. */
let seed = 7;
const roll = (below: number) => {
  seed = (seed * 48_271) % 2_147_483_647;
  return seed % below;
};
const pick = <T>(items: readonly T[]) => items[roll(items.length)] as T;

export interface Dag {
  id: string;
  description: string;
  schedule: string;
  owner: string;
  tags: string[];
  paused: boolean;
  runs: State[];
  lastRun: Date;
  nextRun?: Date;
  minutes: number;
  failedTask?: string;
}

const strip = (last: State, flaky: boolean): State[] => [
  ...Array.from({ length: 13 }, () =>
    flaky && roll(4) === 0 ? ("failed" as const) : ("success" as const),
  ),
  last,
];

const hero = (
  id: string,
  description: string,
  schedule: string,
  owner: string,
  tags: string[],
  last: State,
  lastMinutes: number,
  nextMinutes: number | undefined,
  minutes: number,
  failedTask?: string,
): Dag => ({
  id,
  description,
  schedule,
  owner,
  tags,
  paused: nextMinutes === undefined,
  runs: strip(last, last === "failed"),
  lastRun: ago(lastMinutes),
  nextRun: nextMinutes === undefined ? undefined : ago(-nextMinutes),
  minutes,
  failedTask,
});

/**
 * Demo only: one grid with every task state. Several runs are active at once,
 * which Airflow allows when `max_active_runs` is above one.
 */
const showcase: State[][] = [
  ["success", "success", "success", "skipped", "skipped", "success"],
  [
    "success",
    "failed",
    "upstream_failed",
    "upstream_failed",
    "upstream_failed",
    "upstream_failed",
  ],
  ["success", "success", "success", "success", "success", "removed"],
  ["success", "success", "up_for_retry", "none", "none", "none"],
  ["success", "up_for_reschedule", "none", "none", "none", "none"],
  ["deferred", "awaiting_input", "none", "none", "none", "none"],
  ["success", "success", "restarting", "none", "none", "none"],
  ["success", "success", "success", "running", "scheduled", "queued"],
];
const showcaseRuns: State[] = [
  "success",
  "failed",
  "success",
  "running",
  "running",
  "running",
  "running",
  "running",
];

const heroes: Dag[] = [
  {
    id: "state_showcase",
    description: "Demo only: every task state in one grid.",
    schedule: "@hourly",
    owner: "platform",
    tags: ["demo"],
    paused: false,
    runs: [
      ...Array.from({ length: 6 }, () => "success" as const),
      ...showcaseRuns,
    ],
    lastRun: ago(4),
    nextRun: ago(-56),
    minutes: 6,
  },
  hero(
    "daily_revenue",
    "Builds the revenue marts that Finance reads at 07:00.",
    "0 5 * * *",
    "analytics",
    ["finance", "dbt", "critical", "sox", "daily-7am"],
    "failed",
    540,
    900,
    18,
    "dbt_test",
  ),
  hero(
    "ingest_stripe_events",
    "Pulls Stripe events into the raw schema.",
    "*/15 * * * *",
    "platform",
    ["ingest"],
    "running",
    3,
    14,
    2,
  ),
  hero(
    "customer_360",
    "Joins CRM, billing and product usage per account.",
    "@hourly",
    "analytics",
    ["marts"],
    "failed",
    58,
    2,
    9,
    "extract_orders",
  ),
  hero(
    "ml_churn_scoring",
    "Scores every active account for churn risk.",
    "0 9 * * *",
    "ml",
    ["ml"],
    "success",
    300,
    1140,
    32,
  ),
  hero(
    "export_to_s3",
    "Writes the partner export to S3.",
    "@weekly",
    "platform",
    ["export"],
    "success",
    4560,
    undefined,
    4,
  ),
  hero(
    "warehouse_vacuum",
    "Optimizes and vacuums large warehouse tables.",
    "0 13 * * *",
    "platform",
    ["maintenance"],
    "running",
    60,
    1380,
    22,
  ),
];

const verbs = [
  "ingest",
  "sync",
  "build",
  "export",
  "refresh",
  "validate",
  "score",
  "backfill",
];
const nouns = [
  "orders",
  "payments",
  "accounts",
  "sessions",
  "invoices",
  "tickets",
  "campaigns",
  "inventory",
  "shipments",
  "ledger",
  "leads",
  "events",
  "products",
  "refunds",
  "contracts",
  "usage",
];
const owners = ["analytics", "platform", "ml", "finance", "growth", "support"];
const schedules = [
  "@daily",
  "@hourly",
  "0 6 * * *",
  "*/30 * * * *",
  "@weekly",
  "0 2 * * 1-5",
];

const generated: Dag[] = Array.from({ length: 158 }, (_, index) => {
  const owner = pick(owners);
  const id = `${verbs[index % verbs.length]}_${nouns[Math.floor(index / verbs.length) % nouns.length]}${index >= 128 ? "_eu" : ""}`;
  const paused = index % 11 === 4;
  const failed = !paused && index % 19 === 2 && index < 150;
  const running = !paused && !failed && index % 23 === 7;
  const last: State = failed ? "failed" : running ? "running" : "success";
  const lastMinutes = running ? 3 + roll(40) : 20 + roll(1400);
  return {
    id,
    description: `Keeps the ${id.split("_")[1]} data for ${owner} up to date.`,
    schedule: pick(schedules),
    owner,
    tags: [
      owner,
      pick(["critical", "dbt", "ingest", "marts", "export"]),
      ...(index % 4 === 0
        ? ["tier-1", "eu-region", "pii"].slice(0, 1 + (index % 3))
        : []),
    ],
    paused,
    runs: strip(last, failed),
    lastRun: ago(lastMinutes),
    nextRun: paused ? undefined : ago(-(5 + roll(1400))),
    minutes: 1 + roll(45),
    failedTask: failed
      ? pick([
          "extract_orders",
          "load_staging",
          "dbt_test",
          "publish_dashboard",
        ])
      : undefined,
  };
});

/** The gallery can show an Airflow on which nothing is failing. */
export const everythingHealthy = (() => {
  try {
    return sessionStorage.getItem("dsui-prototype-failing") === "none";
  } catch {
    return false;
  }
})();

export const dags: Dag[] = [...heroes, ...generated].map((dag) =>
  everythingHealthy && dag.runs.at(-1) === "failed"
    ? { ...dag, runs: [...dag.runs.slice(0, -1), "success" as const] }
    : dag,
);

/* The operator comes from the task instance, the lines from the end of its log. */
const errors: Record<string, [operator: string, lines: string[]]> = {
  dbt_test: [
    "DbtRunOperator",
    [
      "Found 41 models, 118 tests",
      "FAIL unique_fct_revenue_order_id ........ got 37 results",
      "ERROR Got 37 results, configured to fail if != 0",
    ],
  ],
  publish_dashboard: [
    "KubernetesPodOperator",
    [
      "Pod publish-7f2c started",
      "Container exceeded its memory limit of 2Gi",
      "ERROR Pod publish-7f2c failed: OOMKilled",
    ],
  ],
  load_staging: [
    "SnowflakeOperator",
    [
      "Executing: MERGE INTO analytics.staging ...",
      "snowflake.connector.errors.ProgrammingError: 002003",
      "ERROR SQL compilation error: Object 'STAGING.ACCOUNTS' does not exist",
    ],
  ],
  default: [
    "PythonOperator",
    [
      "Fetching page 14 of 52",
      "Traceback (most recent call last):",
      "requests.exceptions.ReadTimeout: Read timed out. (read timeout=30)",
    ],
  ],
};

export const failureOf = (dag: Dag) => {
  const [operator, lines] = (errors[dag.failedTask ?? ""] ??
    errors.default) as [string, string[]];
  return {
    operator,
    tries: 3,
    maxTries: 3,
    log: [...lines, "ERROR Task failed with exit code 1"],
  };
};

export const isFailing = (dag: Dag) =>
  !dag.paused && dag.runs.at(-1) === "failed";
export const isRunning = (dag: Dag) =>
  !dag.paused && dag.runs.at(-1) === "running";
export const failingDags = () =>
  dags
    .filter(isFailing)
    .sort((a, b) => b.lastRun.getTime() - a.lastRun.getTime());

/** Runs in a row that failed, counted back from the latest. */
export const failStreak = (dag: Dag) => {
  let count = 0;
  while (dag.runs[dag.runs.length - 1 - count] === "failed") count += 1;
  return count;
};

export type RunType =
  | "scheduled"
  | "manual"
  | "backfill"
  | "operator_triggered"
  | "asset_triggered"
  | "asset_materialization";
export interface StreamRun {
  id: string;
  dag: string;
  state: State;
  type: RunType;
  started: Date;
  minutes: number;
}

/** Each DAG's latest run, then older ones spread over the last 30 days. */
export const runStream: StreamRun[] = [
  ...dags.map((dag) => ({
    id: `${dag.id}-latest`,
    dag: dag.id,
    state: dag.runs.at(-1) ?? ("success" as const),
    type: "scheduled" as const,
    started: dag.lastRun,
    minutes: dag.minutes,
  })),
  ...Array.from({ length: 2600 }, (_, index) => {
    const dag = pick(dags);
    return {
      id: `run-${index}`,
      dag: dag.id,
      state: (roll(18) === 0 ? "failed" : "success") as State,
      type: (roll(12) === 0
        ? "manual"
        : roll(9) === 0
          ? "asset_triggered"
          : roll(40) === 0
            ? "backfill"
            : "scheduled") as RunType,
      started: ago(30 + roll(43_000)),
      minutes: Math.max(1, dag.minutes + roll(9) - 4),
    };
  }),
  ...Array.from({ length: 4 }, (_, index) => ({
    id: `queued-${index}`,
    dag: pick(dags).id,
    state: "queued" as const,
    type: "scheduled" as const,
    started: ago(index + 1),
    minutes: 0,
  })),
].sort((a, b) => b.started.getTime() - a.started.getTime());

export const taskIds = [
  "extract_orders",
  "extract_payments",
  "load_staging",
  "dbt_run_marts",
  "dbt_test",
  "publish_dashboard",
];

/** Edges of the daily_revenue graph, as [from, to]. */
export const edges: [string, string][] = [
  ["extract_orders", "load_staging"],
  ["extract_payments", "load_staging"],
  ["load_staging", "dbt_run_marts"],
  ["dbt_run_marts", "dbt_test"],
  ["dbt_test", "publish_dashboard"],
];

export const taskKind: Record<string, "python" | "sql" | "dbt" | "http"> = {
  extract_orders: "python",
  extract_payments: "python",
  load_staging: "sql",
  dbt_run_marts: "dbt",
  dbt_test: "dbt",
  publish_dashboard: "http",
};

export interface Run {
  at: Date;
  state: State;
  seconds: number;
  /** Seconds from the start of the run. */
  tasks: { id: string; state: State; start: number; seconds: number }[];
}

const interval: Record<string, number> = {
  "*/15 * * * *": 15,
  "*/30 * * * *": 30,
  "@hourly": 60,
  "@weekly": 10_080,
};

/** Daily and slower schedules keep their hour across a clock change. */
function runStart(latest: Date, stepMinutes: number, back: number) {
  if (stepMinutes < 1440)
    return new Date(latest.getTime() - back * stepMinutes * MINUTE);
  const start = new Date(latest);
  start.setDate(start.getDate() - back * (stepMinutes / 1440));
  return start;
}

/** States in which a task has started, so it has a start time and duration. */
const timed: readonly State[] = [
  "success",
  "failed",
  "running",
  "restarting",
  "up_for_retry",
  "up_for_reschedule",
  "deferred",
  "awaiting_input",
];
export const hasTiming = (state: State) => timed.includes(state);

/** How many runs the grid shows. */
const HISTORY = 52;
const histories = new Map<string, Run[]>();

/** A DAG's latest runs, oldest first. The list and the grid share them. */
export function historyOf(dag: Dag): Run[] {
  const known = histories.get(dag.id);
  if (known) return known;
  const step = interval[dag.schedule] ?? 1440;
  const salt = [...dag.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const runs = Array.from({ length: HISTORY }, (_, index): Run => {
    const back = HISTORY - 1 - index;
    const state: State =
      dag.runs[dag.runs.length - 1 - back] ??
      ((index + salt) % 31 === 4 ? "failed" : "success");
    const noise = (index * 37 + salt) % 41;
    const at = runStart(dag.lastRun, step, back);
    at.setSeconds(noise % 9);
    const slow = (index + salt) % 23 === 7 ? 1.7 : 1;
    const total = Math.round(dag.minutes * 60 * (0.85 + noise / 130) * slow);
    const shares = [0.15, 0.22, 0.11, 0.44, 0.11, 0.06];
    const lengths = shares.map((share) =>
      Math.max(4, Math.round(total * share)),
    );
    const [orders = 0, payments = 0, staging = 0, marts = 0, tests = 0] =
      lengths;
    const loaded = Math.max(orders, payments);
    const starts = [
      0,
      0,
      loaded,
      loaded + staging,
      loaded + staging + marts,
      loaded + staging + marts + tests,
    ];
    const stopsAt = Math.max(0, taskIds.indexOf(dag.failedTask ?? "dbt_test"));
    const tasks = taskIds.map((id, task) => ({
      id,
      state: (state === "failed" && task === stopsAt
        ? "failed"
        : state === "failed" && task > stopsAt && task > 1
          ? "upstream_failed"
          : state === "running" && task === 3
            ? "running"
            : state === "running" && task > 3
              ? "none"
              : "success") as State,
      start: starts[task] ?? 0,
      seconds: lengths[task] ?? 0,
    }));
    const shown =
      dag.id === "state_showcase"
        ? showcase[showcase.length - 1 - back]
        : undefined;
    if (shown)
      for (const [task, item] of tasks.entries())
        item.state = shown[task] ?? "none";
    const ran = tasks.filter((task) => hasTiming(task.state));
    return {
      at,
      state,
      seconds: Math.max(1, ...ran.map((task) => task.start + task.seconds)),
      tasks,
    };
  });
  histories.set(dag.id, runs);
  return runs;
}

const pad = (value: number) => String(Math.floor(value)).padStart(2, "0");
export const hms = (seconds: number) =>
  `${pad(seconds / 3600)}:${pad((seconds % 3600) / 60)}:${pad(seconds % 60)}`;
export const stampSeconds = (date: Date) =>
  `${stamp(date)}:${pad(date.getSeconds())}`;

export const sourceOf = (dag: Dag) => `"""${dag.description}"""

from datetime import datetime, timedelta

from airflow.sdk import DAG, task
from airflow.providers.common.sql.operators.sql import SQLExecuteQueryOperator
from cosmos import DbtTaskGroup

DEFAULT_ARGS = {
    "owner": "${dag.owner}",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
}

with DAG(
    dag_id="${dag.id}",
    schedule="${dag.schedule}",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    max_active_runs=1,
    default_args=DEFAULT_ARGS,
    tags=[${dag.tags.map((tag) => `"${tag}"`).join(", ")}],
) as dag:

    @task(pool="stripe_api")
    def extract_orders(data_interval_start, data_interval_end):
        # Only the rows that changed in this interval.
        client = OrdersClient.from_connection("billing_db")
        rows = client.fetch(since=data_interval_start, until=data_interval_end)
        return write_parquet(rows, "s3://acme-lake/raw/orders")

    @task(pool="stripe_api")
    def extract_payments(data_interval_start, data_interval_end):
        client = PaymentsClient.from_connection("stripe_api")
        return write_parquet(
            client.list(created_after=data_interval_start),
            "s3://acme-lake/raw/payments",
        )

    load_staging = SQLExecuteQueryOperator(
        task_id="load_staging",
        conn_id="warehouse",
        sql="sql/load_staging.sql",
    )

    dbt_run_marts = DbtTaskGroup(group_id="dbt_run_marts", select=["marts.+"])
    dbt_test = DbtTaskGroup(group_id="dbt_test", select=["test_type:data"], pool="dbt")

    @task
    def publish_dashboard():
        refresh_dashboard("revenue", timeout_seconds=300)

    [extract_orders(), extract_payments()] >> load_staging
    load_staging >> dbt_run_marts >> dbt_test >> publish_dashboard()
`;

export const failureLog = `[05:09:12] INFO  Running with dbt=1.9.2
[05:09:18] INFO  Found 41 models, 118 tests
[05:09:44] PASS  not_null_fct_revenue_order_id
[05:09:51] FAIL  unique_fct_revenue_order_id ........ got 37 results
[05:09:51] ERROR Failure in test unique_fct_revenue_order_id
[05:09:51] ERROR   Got 37 results, configured to fail if != 0
[05:09:52] INFO  Done. PASS=117 WARN=0 ERROR=1 SKIP=0
[05:09:53] ERROR Task failed with exit code 1`;

export interface Asset {
  id: string;
  name: string;
  uri: string;
  group: string;
  producers: string[];
  /** DAGs whose schedule waits for this asset. */
  scheduled: string[];
  lastEvent?: Date;
}

const asset = (
  id: string,
  name: string,
  uri: string,
  group: string,
  producers: string[],
  scheduled: string[],
  minutes?: number,
): Asset => ({
  id,
  name,
  uri,
  group,
  producers,
  scheduled,
  lastEvent: minutes === undefined ? undefined : ago(minutes),
});

export const assets: Asset[] = [
  asset(
    "raw_orders",
    "raw_orders",
    "postgres://warehouse/raw/orders",
    "raw",
    ["ingest_stripe_events"],
    ["daily_revenue", "customer_360"],
    16,
  ),
  asset(
    "fct_revenue",
    "fct_revenue",
    "snowflake://warehouse/marts/fct_revenue",
    "marts",
    ["daily_revenue"],
    ["ml_churn_scoring", "export_to_s3"],
    1980,
  ),
  asset(
    "dim_accounts",
    "dim_accounts",
    "snowflake://warehouse/marts/dim_accounts",
    "marts",
    ["customer_360"],
    ["ml_churn_scoring"],
    300,
  ),
  asset(
    "partner_export",
    "partner_export",
    "s3://acme-exports/partner/",
    "exports",
    ["export_to_s3"],
    [],
    17_280,
  ),
  ...Array.from({ length: 43 }, (_, index) => {
    const noun = nouns[index % nouns.length] as string;
    const group = pick(["raw", "staging", "marts"]);
    return asset(
      `asset_${index}`,
      `${group}_${noun}_${index}`,
      `s3://acme-lake/${group}/${noun}_${index}`,
      group,
      [generated[index]?.id ?? "daily_revenue"],
      index % 3 ? [generated[index + 50]?.id ?? "customer_360"] : [],
      index % 13 === 5 ? undefined : 10 + roll(3000),
    );
  }),
];

export interface AssetEvent {
  at: Date;
  sourceDag: string;
  sourceTask: string;
  triggered: number;
}

export const eventsOf = (item: Asset): AssetEvent[] =>
  item.lastEvent
    ? Array.from({ length: 64 }, (_, index) => ({
        at: new Date(
          (item.lastEvent as Date).getTime() - index * 1440 * MINUTE,
        ),
        sourceDag: item.producers[0] ?? "unknown",
        sourceTask: "publish",
        triggered: item.scheduled.length,
      }))
    : [];

export interface Connection {
  id: string;
  type: string;
  host: string;
  port?: number;
  schema: string;
  login: string;
  description: string;
}

const connectionTypes = [
  "postgres",
  "snowflake",
  "aws",
  "http",
  "slack",
  "mysql",
  "redshift",
  "sftp",
  "google_cloud_platform",
];
const connection = (
  id: string,
  type: string,
  host: string,
  port: number | undefined,
  schema: string,
  login: string,
  description: string,
): Connection => ({ id, type, host, port, schema, login, description });

export const connections: Connection[] = [
  connection(
    "warehouse",
    "snowflake",
    "acme.eu-central-1",
    undefined,
    "ANALYTICS",
    "airflow",
    "Main warehouse",
  ),
  connection(
    "billing_db",
    "postgres",
    "billing.internal",
    5432,
    "billing",
    "airflow_ro",
    "Billing replica",
  ),
  connection("exports_bucket", "aws", "", undefined, "", "", "Partner exports"),
  connection(
    "stripe_api",
    "http",
    "api.stripe.com",
    443,
    "",
    "",
    "Stripe REST API",
  ),
  ...Array.from({ length: 37 }, (_, index) => {
    const type = connectionTypes[index % connectionTypes.length] as string;
    const noun = nouns[index % nouns.length] as string;
    return connection(
      `${noun}_${type}_${index}`,
      type,
      `${noun}.internal`,
      type === "postgres" ? 5432 : undefined,
      noun,
      "airflow",
      `${noun} access for ${pick(owners)}`,
    );
  }),
].sort((a, b) => a.id.localeCompare(b.id));

export interface Variable {
  key: string;
  value: string;
  description: string;
}

export const variables: Variable[] = [
  {
    key: "environment",
    value: "production",
    description: "Which stack this is.",
  },
  {
    key: "revenue_lookback_days",
    value: "35",
    description: "Days that daily_revenue rebuilds.",
  },
  {
    key: "slack_webhook_secret",
    value: "***",
    description: "Airflow masks values of sensitive keys.",
  },
  {
    key: "dbt_config",
    value:
      '{"target": "prod", "threads": 8, "full_refresh": false, "vars": {"start_date": "2024-01-01"}}',
    description: "Passed to every dbt task.",
  },
  ...Array.from({ length: 58 }, (_, index) => {
    const noun = nouns[index % nouns.length] as string;
    const kind = ["batch_size", "bucket", "enabled", "alert_channel"][
      index % 4
    ] as string;
    return {
      key: `${noun}_${kind}_${index}`,
      value:
        kind === "bucket"
          ? `s3://acme-${noun}/landing`
          : kind === "enabled"
            ? "true"
            : kind === "batch_size"
              ? String(500 + roll(5000))
              : `#data-${noun}`,
      description: index % 3 ? `Used by the ${noun} DAGs.` : "",
    };
  }),
].sort((a, b) => a.key.localeCompare(b.key));

export interface LogEvent {
  id: number;
  at: Date;
  who: string;
  event: string;
  dag: string;
  task: string;
}

const people = ["maja", "kuba", "ola", "tomek", "ana"];
const everyDagEvent: LogEvent[] = Array.from({ length: 1284 }, (_, index) => {
  const manual = roll(6) === 0;
  const event = manual
    ? pick([
        "trigger_dag_run",
        "patch_dag",
        "post_clear_task_instances",
        "patch_pool",
        "patch_variable",
      ])
    : pick(["running", "success", "success", "success", "failed"]);
  const dag =
    event === "patch_pool" || event === "patch_variable" ? "" : pick(dags).id;
  return {
    id: 90_000 - index,
    at: ago(index * 7 + roll(6)),
    who: manual ? pick(people) : "airflow",
    event,
    dag,
    task: manual || !dag ? "" : pick(taskIds),
  };
});

export const pools = [
  {
    name: "default_pool",
    slots: 128,
    running: 41,
    queued: 3,
    description: "Everything without its own pool.",
  },
  {
    name: "dbt",
    slots: 8,
    running: 8,
    queued: 5,
    description: "Limits concurrent dbt invocations.",
  },
  {
    name: "stripe_api",
    slots: 4,
    running: 1,
    queued: 0,
    description: "Keeps us under the Stripe rate limit.",
  },
];

/* One DAG with a long history, interleaved with everything else. */
const revenueEvents: LogEvent[] = Array.from({ length: 96 }, (_, index) => {
  const manual = index % 9 === 4;
  const person = people[index % people.length] as string;
  return {
    id: 95_000 - index,
    at: ago(530 + index * 290),
    who: manual ? person : "airflow",
    event: manual
      ? index % 2
        ? "post_clear_task_instances"
        : "trigger_dag_run"
      : index === 0 || index % 13 === 5
        ? "failed"
        : "success",
    dag: "daily_revenue",
    task: manual ? "" : (taskIds[(index + 4) % taskIds.length] ?? ""),
  };
});

export const eventLog: LogEvent[] = [
  ...everyDagEvent.filter((item) => item.dag !== "daily_revenue"),
  ...revenueEvents,
].sort((a, b) => b.at.getTime() - a.at.getTime());

export const health = [
  { name: "Scheduler", ok: true, detail: "heartbeat 4 s ago" },
  { name: "Triggerer", ok: true, detail: "heartbeat 9 s ago" },
  { name: "DAG processor", ok: true, detail: "parsed 6 DAGs" },
  { name: "Metadata database", ok: true, detail: "12 ms" },
];
