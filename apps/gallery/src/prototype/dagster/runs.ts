/* What ran: runs, their steps and their events. */
import { assetByKey } from "./graph";
import { type JobDef, jobByName, jobs } from "./jobs";
import { everythingHealthy, hash } from "./scenario";
import type { RunStatus, StepStatus } from "./states";
import { ago, isoDay, NOW } from "./time";

/** Dagster's implicit job for materializing a chosen set of assets. */
export const ADHOC = "__ASSET_JOB";

export interface Launcher {
  kind: "schedule" | "sensor" | "backfill" | "manual" | "automation";
  name: string;
}

export interface Run {
  id: string;
  job: string;
  status: RunStatus;
  created: Date;
  start?: Date;
  end?: Date;
  by: Launcher;
  /** Asset keys this run was asked to materialize. */
  selection: string[];
  partition?: string;
  backfill?: string;
  failure?: { step: string; error: string; attempts: number; line: string };
  /** Why a queued run waits. */
  waiting?: string;
}

export const runId = (seed: string) => hash(seed).toString(16).padStart(8, "0");

const errors: Record<string, [line: string, trace: string]> = {
  "core/fct_invoices": [
    "SQL compilation error: invalid identifier 'COUPON_PERCENT_OFF'",
    "dagster_dbt.errors.DagsterDbtCliRuntimeError: The dbt CLI process failed with exit code 1.\n\n  Database Error in model fct_invoices (models/core/fct_invoices.sql)\n  000904 (42000): SQL compilation error: error line 14 at position 6\n  invalid identifier 'COUPON_PERCENT_OFF'\n  compiled Code at target/run/acme/models/core/fct_invoices.sql",
  ],
  "raw_hubspot/hubspot_ad_spend": [
    "HTTPError: 429 Too Many Requests, retry after 3600 seconds",
    'requests.exceptions.HTTPError: 429 Client Error: Too Many Requests for url: https://api.hubapi.com/marketing/v3/spend\n  File "ingestion/sling/hubspot.py", line 88, in sync_ad_spend\n    response.raise_for_status()',
  ],
  "ml_models/churn_scores": [
    "KeyError: 'days_since_last_login'",
    "KeyError: 'days_since_last_login'\n  File \"ml/churn/score.py\", line 41, in churn_scores\n    features = frame[model.feature_names_in_]",
  ],
};

const baseSeconds = (step: string) =>
  step.startsWith("ml_models/")
    ? 240 + (hash(step) % 900)
    : step.startsWith("raw_")
      ? 25 + (hash(step) % 140)
      : 8 + (hash(step) % 55);

export interface Step {
  key: string;
  /** The name shown, which is the last part of the asset key. */
  name: string;
  asset?: string;
  status?: StepStatus;
  /** Seconds after the run started. */
  from: number;
  seconds: number;
  /** Start offsets of every attempt, the last one included. */
  attempts: { from: number; seconds: number }[];
  upstream: string[];
}

/** Steps in dependency order, timed so that a step waits for its upstream. */
export function stepsOf(run: Run): Step[] {
  const job = jobByName.get(run.job);
  const keys = job?.ops ?? run.selection;
  const inside = new Set(keys);
  const upstreamOf = (key: string, index: number) =>
    job?.ops
      ? index
        ? [keys[index - 1] as string]
        : []
      : (assetByKey.get(key)?.deps ?? []).filter((dep) => inside.has(dep));
  const done = new Map<string, Step>();
  const build = (key: string): Step => {
    const found = done.get(key);
    if (found) return found;
    const upstream = upstreamOf(key, keys.indexOf(key));
    const before = upstream.map(build);
    const from = Math.max(2, ...before.map((step) => step.from + step.seconds));
    const jitter = 0.8 + (hash(run.id + key) % 50) / 100;
    const step: Step = {
      key,
      name: key.split("/").at(-1) as string,
      asset: job?.ops ? undefined : key,
      status: "SUCCESS",
      from,
      seconds: Math.round(baseSeconds(key) * jitter),
      attempts: [],
      upstream,
    };
    if (run.failure?.step === key) {
      step.status = "FAILURE";
      const each = Math.max(4, Math.round(step.seconds / 3));
      for (let attempt = 0; attempt < run.failure.attempts; attempt += 1)
        step.attempts.push({
          from: from + attempt * (each + 30),
          seconds: each,
        });
      step.seconds = run.failure.attempts * (each + 30) - 30;
    } else if (before.some((item) => item.status !== "SUCCESS")) {
      step.status = "SKIPPED";
      step.seconds = 0;
    }
    if (!step.attempts.length)
      step.attempts.push({ from, seconds: step.seconds });
    done.set(key, step);
    return step;
  };
  const steps = keys.map(build).sort((a, b) => a.from - b.from);
  if (run.status === "SUCCESS" || run.status === "FAILURE") return steps;
  if (!run.start)
    return steps.map((step) => ({ ...step, status: undefined, seconds: 0 }));
  // A run that has not finished has only got as far as the clock.
  const elapsed = ((run.end ?? NOW).getTime() - run.start.getTime()) / 1000;
  return steps.map((step) => {
    if (step.from + step.seconds <= elapsed) return step;
    if (step.from < elapsed && run.status !== "CANCELED")
      return { ...step, status: "IN_PROGRESS", seconds: elapsed - step.from };
    return { ...step, status: undefined, seconds: 0 };
  });
}

const totalSeconds = (run: Run) =>
  Math.max(
    4,
    ...stepsOf({ ...run, status: "SUCCESS" }).map(
      (step) => step.from + step.seconds,
    ),
  ) + 3;

export const duration = (run: Run) =>
  run.start ? ((run.end ?? NOW).getTime() - run.start.getTime()) / 1000 : 0;

function finished(run: Run): Run {
  if (!run.start) return run;
  return {
    ...run,
    end: new Date(run.start.getTime() + totalSeconds(run) * 1000),
  };
}

function fail(run: Run, step: string, attempts: number): Run {
  const [line, error] = errors[step] ?? ["Step failed", "Step failed"];
  return finished({
    ...run,
    status: "FAILURE",
    failure: { step, line, error, attempts },
  });
}

/** Which scheduled runs failed, as minutes before now. */
const failing: [
  job: string,
  minutes: number,
  step: string,
  attempts: number,
][] = everythingHealthy
  ? []
  : [
      ["dbt_core_build", 25, "core/fct_invoices", 1],
      ["dbt_core_build", 85, "core/fct_invoices", 1],
      ["ingest_hubspot", 80, "raw_hubspot/hubspot_ad_spend", 3],
      ["ml_scoring", 360, "ml_models/churn_scores", 2],
      ["ingest_hubspot", 2960, "raw_hubspot/hubspot_ad_spend", 3],
    ];

/** Minutes since the latest start of a schedule, at or before a moment. */
function scheduled(job: JobDef): number[] {
  if (!job.every) return [];
  const every = job.every;
  const nowMinutes = NOW.getHours() * 60;
  // Weekly runs land on Monday; the others repeat within a day.
  const latest =
    every === 10_080
      ? 4 * 1440 + nowMinutes - (job.offset ?? 0)
      : (((nowMinutes - (job.offset ?? 0)) % every) + every) % every;
  const count = Math.min(Math.floor((7 * 1440) / every), 400);
  return Array.from(
    { length: Math.max(count, 8) },
    (_, index) => latest + index * every,
  );
}

function scheduledRuns(job: JobDef): Run[] {
  return scheduled(job).map((minutes) => {
    const run: Run = {
      id: runId(`${job.name}:${minutes}`),
      job: job.name,
      status: "SUCCESS",
      created: ago(minutes),
      start: new Date(ago(minutes).getTime() + 6000),
      by: { kind: "schedule", name: `${job.name}_schedule` },
      selection: job.assets,
    };
    const broken = failing.find(
      ([name, at]) => name === job.name && at === minutes,
    );
    if (broken) return fail(run, broken[2], broken[3]);
    return finished(run);
  });
}

function sensorRuns(): Run[] {
  const job = jobByName.get("reverse_etl_sync") as JobDef;
  return Array.from({ length: 42 }, (_, index) =>
    finished({
      id: runId(`etl:${index}`),
      job: job.name,
      status: "SUCCESS",
      created: ago(52 + index * 240),
      start: ago(52 + index * 240),
      by: { kind: "sensor", name: "reverse_etl_sensor" },
      selection: job.assets,
    }),
  );
}

function open(
  seed: string,
  job: string,
  status: RunStatus,
  minutes: number,
  extra: Partial<Run> = {},
): Run {
  return {
    id: runId(seed),
    job,
    status,
    created: ago(minutes),
    start: status === "QUEUED" ? undefined : ago(minutes),
    by: { kind: "manual", name: "Launched by hand" },
    selection: jobByName.get(job)?.assets ?? [],
    ...extra,
  };
}

const pageViews = ["core/fct_page_views"];
const events = ["core/fct_product_events"];

function openRuns(): Run[] {
  const waiting = "Waiting for a slot in the fivetran_api pool (2 of 2 used)";
  return [
    open("now:pg", "ingest_app_postgres", "STARTED", 5, {
      by: { kind: "schedule", name: "ingest_app_postgres_schedule" },
    }),
    open("now:product", "product_marts", "STARTED", 1, {
      by: { kind: "automation", name: "default_automation_condition_sensor" },
    }),
    open("now:bf1", ADHOC, "STARTED", 0.4, {
      by: { kind: "backfill", name: "ynqcpdxa" },
      backfill: "ynqcpdxa",
      partition: "2026-09-14",
      selection: events,
    }),
    open("now:starting", ADHOC, "STARTING", 0.2, {
      selection: ["marts_finance/revenue_daily"],
      partition: "2026-11-26",
    }),
    open("now:q1", "ingest_hubspot", "QUEUED", 4, { waiting }),
    open("now:q2", "ingest_shopify", "QUEUED", 3, { waiting }),
    open("now:q3", ADHOC, "QUEUED", 0.6, {
      by: { kind: "backfill", name: "ynqcpdxa" },
      backfill: "ynqcpdxa",
      partition: "2026-09-15",
      selection: events,
    }),
    open("now:canceling", "ml_training", "CANCELING", 9),
    finished(open("old:canceled", "marketing_marts", "CANCELED", 190, {})),
  ];
}

function backfillRuns(): Run[] {
  const made: Run[] = [];
  const from = new Date(2026, 8, 1);
  for (let index = 0; index < 13; index += 1) {
    const day = new Date(from.getTime() + index * 86_400_000);
    made.push(
      finished({
        id: runId(`bf1:${index}`),
        job: ADHOC,
        status: "SUCCESS",
        created: ago(60 - index * 4),
        start: ago(60 - index * 4),
        by: { kind: "backfill", name: "ynqcpdxa" },
        backfill: "ynqcpdxa",
        partition: isoDay(day),
        selection: events,
      }),
    );
  }
  for (let index = 0; index < 30; index += 1) {
    const day = new Date(2026, 9, 1 + index);
    const run: Run = {
      id: runId(`bf2:${index}`),
      job: ADHOC,
      status: "SUCCESS",
      created: ago(1500 + index * 3),
      start: ago(1500 + index * 3),
      by: { kind: "backfill", name: "hrtmwzka" },
      backfill: "hrtmwzka",
      partition: isoDay(day),
      selection: pageViews,
    };
    made.push(
      !everythingHealthy && [4, 11, 12].includes(index)
        ? finished({
            ...run,
            status: "FAILURE",
            failure: {
              step: pageViews[0] as string,
              attempts: 2,
              line: "Statement reached its statement or warehouse timeout of 3,600 second(s)",
              error:
                "snowflake.connector.errors.ProgrammingError: 000630 (57014): Statement reached its statement or warehouse timeout of 3,600 second(s) and was canceled.",
            },
          })
        : finished(run),
    );
  }
  return made;
}

const unfinished = openRuns();
/** A schedule's tick that is still running is not also a finished run. */
const stillOpen = (run: Run) =>
  unfinished.some(
    (other) =>
      other.by.name === run.by.name &&
      other.created.getTime() === run.created.getTime(),
  );

export const runs: Run[] = [
  ...unfinished,
  ...jobs.flatMap(scheduledRuns).filter((run) => !stillOpen(run)),
  ...sensorRuns(),
  ...backfillRuns(),
].sort((a, b) => b.created.getTime() - a.created.getTime());

export const runById = new Map(runs.map((run) => [run.id, run]));

export const isActive = (run: Run) =>
  ["QUEUED", "STARTING", "STARTED", "CANCELING"].includes(run.status);

export const runTitle = (run: Run) =>
  run.job === ADHOC
    ? run.selection.length === 1
      ? `Asset: ${run.selection[0]?.split("/").at(-1)}`
      : `${run.selection.length} assets`
    : run.job;
