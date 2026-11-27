/* Automation, backfills and the deployment. */
import { type JobDef, jobs } from "./jobs";
import { ADHOC, type Run, runs } from "./runs";
import { everythingHealthy, hash } from "./scenario";
import type { BackfillStatus, TickStatus } from "./states";
import { ago, NOW } from "./time";

export interface Tick {
  at: Date;
  status: TickStatus;
  runs: Run[];
  skipReason?: string;
  error?: string;
}

export interface Instigator {
  name: string;
  kind: "schedule" | "sensor";
  running: boolean;
  /** What it launches. */
  target: string;
  job?: string;
  location: string;
  cron?: string;
  cronText?: string;
  sensorType?: string;
  interval?: string;
  next?: Date;
  ticks: Tick[];
}

function scheduleTicks(job: JobDef): Tick[] {
  return runs
    .filter((run) => run.by.kind === "schedule" && run.job === job.name)
    .slice(0, 60)
    .map((run) => ({
      at: run.created,
      status: "SUCCESS" as const,
      runs: [run],
    }));
}

const schedules: Instigator[] = jobs
  .filter((job) => job.cron)
  .map((job) => {
    const stopped = job.name === "warehouse_maintenance";
    const ticks = scheduleTicks(job);
    const last = ticks[0]?.at ?? ago(job.every ?? 60);
    return {
      name: `${job.name}_schedule`,
      kind: "schedule",
      running: !stopped,
      target: job.name,
      job: job.name,
      location: job.location,
      cron: job.cron,
      cronText: job.cronText,
      next: stopped
        ? undefined
        : new Date(last.getTime() + (job.every ?? 60) * 60_000),
      ticks,
    };
  });

function sensor(
  name: string,
  sensorType: string,
  interval: string,
  every: number,
  target: string,
  location: string,
  idle: string,
  extra: Partial<Instigator> & { broken?: string; fires?: string } = {},
): Instigator {
  const { broken, fires, ...rest } = extra;
  const fired = fires
    ? runs.filter((run) => run.by.kind === "sensor" && run.by.name === fires)
    : [];
  const ticks: Tick[] = Array.from({ length: 60 }, (_, index) => {
    const at = ago(1 + index * every);
    const run = fired.find(
      (item) =>
        Math.abs(item.created.getTime() - at.getTime()) < every * 30_000,
    );
    if (broken && !everythingHealthy && index < 7)
      return { at, status: "FAILURE", runs: [], error: broken };
    if (run) return { at, status: "SUCCESS", runs: [run] };
    if (!fires && hash(name + index) % 9 === 0 && sensorType === "Automation")
      return { at, status: "SUCCESS", runs: runs.slice(1, 2) };
    return { at, status: "SKIPPED", runs: [], skipReason: idle };
  });
  const running = rest.running ?? true;
  return {
    name,
    kind: "sensor",
    sensorType,
    interval,
    target,
    location,
    next: running ? new Date(NOW.getTime() + every * 60_000) : undefined,
    ...rest,
    running,
    ticks: running
      ? ticks
      : ticks.map((tick) => ({
          ...tick,
          at: new Date(tick.at.getTime() - 9 * 86_400_000),
        })),
  };
}

export const instigators: Instigator[] = [
  ...schedules,
  sensor(
    "default_automation_condition_sensor",
    "Automation",
    "Every 30 seconds",
    1,
    "Assets with an automation condition",
    "analytics",
    "No automation condition is met",
  ),
  sensor(
    "reverse_etl_sensor",
    "Multi-asset",
    "Every minute",
    4,
    "reverse_etl_sync",
    "reverse_etl",
    "Scores and metrics have not changed",
    { job: "reverse_etl_sync", fires: "reverse_etl_sensor" },
  ),
  sensor(
    "partner_files_sensor",
    "Standard",
    "Every 5 minutes",
    5,
    "ingest_hubspot",
    "ingestion",
    "No new files in s3://acme-partner-inbound/",
    {
      job: "ingest_hubspot",
      broken:
        "botocore.exceptions.ClientError: An error occurred (AccessDenied) when calling the ListObjectsV2 operation: Access Denied",
    },
  ),
  sensor(
    "slack_on_run_failure",
    "Run status",
    "Every 30 seconds",
    3,
    "Posts to #data-alerts",
    "analytics",
    "No run has failed since the last evaluation",
  ),
  sensor(
    "salesforce_cdc_sensor",
    "Standard",
    "Every 10 minutes",
    10,
    "ingest_salesforce",
    "ingestion",
    "No change events",
    { job: "ingest_salesforce", running: false },
  ),
];

export const instigatorByName = new Map(
  instigators.map((item) => [item.name, item]),
);

export const tickFailing = () =>
  instigators.filter(
    (item) => item.running && item.ticks[0]?.status === "FAILURE",
  );

export interface Backfill {
  id: string;
  status: BackfillStatus;
  asset: string;
  created: Date;
  by: string;
  from: string;
  to: string;
  total: number;
  done: number;
  failed: number;
  running: number;
  canceled: number;
}

const range = (
  id: string,
  status: BackfillStatus,
  asset: string,
  minutes: number,
  by: string,
  from: string,
  to: string,
  total: number,
  done: number,
  extra: Partial<Backfill> = {},
): Backfill => ({
  id,
  status,
  asset,
  created: ago(minutes),
  by,
  from,
  to,
  total,
  done,
  failed: 0,
  running: 0,
  canceled: 0,
  ...extra,
});

export const backfills: Backfill[] = [
  range(
    "ynqcpdxa",
    "REQUESTED",
    "core/fct_product_events",
    62,
    "marta.n",
    "2026-09-01",
    "2026-09-30",
    30,
    13,
    { running: 2 },
  ),
  everythingHealthy
    ? range(
        "hrtmwzka",
        "COMPLETED_SUCCESS",
        "core/fct_page_views",
        1500,
        "jan.k",
        "2026-10-01",
        "2026-10-30",
        30,
        30,
      )
    : range(
        "hrtmwzka",
        "COMPLETED_FAILED",
        "core/fct_page_views",
        1500,
        "jan.k",
        "2026-10-01",
        "2026-10-30",
        30,
        27,
        { failed: 3 },
      ),
  range(
    "bqfkdsle",
    "COMPLETED_SUCCESS",
    "marts_finance/revenue_daily",
    4400,
    "finance-bot",
    "2026-08-01",
    "2026-08-31",
    31,
    31,
  ),
  range(
    "mzoeprta",
    "CANCELED",
    "core/fct_orders",
    6100,
    "marta.n",
    "2025-01-01",
    "2025-12-31",
    365,
    112,
    { canceled: 253 },
  ),
  ...Array.from({ length: 24 }, (_, index) =>
    range(
      `${hash(`backfill${index}`).toString(26)}qwertyui`
        .replace(/\d/g, (d) => "abcdefghij"[Number(d)] as string)
        .slice(0, 8),
      "COMPLETED_SUCCESS",
      [
        "core/fct_charges",
        "core/fct_invoices",
        "core/fct_subscriptions",
        "marts_product/daily_active_users",
      ][index % 4] as string,
      8000 + index * 2100,
      ["jan.k", "marta.n", "ola.w", "finance-bot"][index % 4] as string,
      "2026-07-01",
      `2026-07-${String(2 + (index % 28)).padStart(2, "0")}`,
      2 + (index % 28),
      2 + (index % 28),
    ),
  ),
];

export const backfillById = new Map(backfills.map((item) => [item.id, item]));
export const backfillRunsOf = (id: string) =>
  runs.filter((run) => run.backfill === id && run.job === ADHOC);

export interface CodeLocation {
  name: string;
  loaded: boolean;
  updated: Date;
  image: string;
  module: string;
  error?: string;
}

export const locations: CodeLocation[] = [
  {
    name: "ingestion",
    loaded: true,
    updated: ago(2900),
    image: "acme/dagster-ingestion:2026.11.25-1",
    module: "ingestion.definitions",
  },
  {
    name: "analytics",
    loaded: true,
    updated: ago(190),
    image: "acme/dagster-analytics:2026.11.27-3",
    module: "analytics.definitions",
  },
  {
    name: "ml",
    loaded: true,
    updated: ago(1600),
    image: "acme/dagster-ml:2026.11.26-2",
    module: "ml.definitions",
  },
  {
    name: "reverse_etl",
    loaded: true,
    updated: ago(7300),
    image: "acme/dagster-reverse-etl:2026.11.22-1",
    module: "reverse_etl.definitions",
  },
  {
    name: "marketing_experiments",
    loaded: everythingHealthy,
    updated: ago(48),
    image: "acme/dagster-marketing:2026.11.27-1",
    module: "experiments.definitions",
    error: everythingHealthy
      ? undefined
      : "dagster._core.errors.DagsterUserCodeLoadError: Error occurred during the loading of Dagster definitions in module experiments.definitions\n\nModuleNotFoundError: No module named 'statsmodels'\n  File \"experiments/assets/uplift.py\", line 6, in <module>\n    import statsmodels.api as sm",
  },
];

export const daemons: [name: string, beat: Date][] = [
  ["Scheduler", ago(0.2)],
  ["Sensor", ago(0.15)],
  ["Backfill", ago(0.4)],
  ["Queued run coordinator", ago(0.1)],
  ["Asset (declarative automation)", ago(0.3)],
  ["Run monitoring", ago(0.8)],
];

export interface Pool {
  name: string;
  limit: number;
  used: number;
  queued: number;
}

export const pools: Pool[] = [
  { name: "fivetran_api", limit: 2, used: 2, queued: 2 },
  { name: "snowflake_transform", limit: 8, used: 3, queued: 0 },
  { name: "ml_gpu", limit: 2, used: 1, queued: 0 },
];
