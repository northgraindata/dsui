/* The state of every asset, read from what ran. */
import { type AssetDef, assetByKey, assets } from "./graph";
import { isActive, type Run, runs, stepsOf } from "./runs";
import { everythingHealthy, hash } from "./scenario";
import type { CheckStatus } from "./states";
import { ago, isoDay, NOW } from "./time";

export interface Materialization {
  at: Date;
  run: Run;
  partition?: string;
  rows: number;
  seconds: number;
}

export interface Check {
  name: string;
  asset: string;
  description: string;
  status: CheckStatus;
  severity: "WARN" | "ERROR";
  blocking: boolean;
  at: Date;
  detail?: string;
}

const history = new Map<string, Materialization[]>();
const attempts = new Map<string, { run: Run; ok: boolean }>();
export const materializing = new Map<string, Run>();

/** New assets that have never run. */
const never = new Set([
  "ml_models/expansion_model",
  "activation/salesforce_expansion_flags",
]);

// Newest first, so the first run seen for an asset is its latest.
for (const run of runs) {
  if (!run.start) continue;
  for (const step of stepsOf(run)) {
    const key = step.asset;
    if (!key || never.has(key)) continue;
    if (step.status === "IN_PROGRESS" && isActive(run))
      materializing.set(key, run);
    if (step.status !== "SUCCESS" && step.status !== "FAILURE") continue;
    if (!attempts.has(key))
      attempts.set(key, { run, ok: step.status === "SUCCESS" });
    if (step.status !== "SUCCESS") continue;
    const list = history.get(key) ?? [];
    if (list.length >= 40) continue;
    list.push({
      at: new Date(run.start.getTime() + (step.from + step.seconds) * 1000),
      run,
      partition: run.partition,
      rows: Math.round(
        (2000 + (hash(key) % 900_000)) * (1 - list.length * 0.004) +
          (hash(run.id + key) % 700),
      ),
      seconds: step.seconds,
    });
    history.set(key, list);
  }
}

export const materializationsOf = (key: string) => history.get(key) ?? [];

/** Why Dagster calls an asset stale. */
const staleCauses: Record<string, string> = {
  "marts_finance/arr_bridge": "mrr_by_plan has a new code version",
  "marts_finance/board_metrics": "arr_bridge is stale",
  "ml_models/churn_model": "churn_training_set has a new data version",
};

const failedChecks: Record<string, string> = everythingHealthy
  ? {}
  : {
      "core/dim_customers:not_null_email": "37 rows have no email address.",
      "marts_finance/revenue_daily:matches_stripe_payouts":
        "Revenue differs from Stripe payouts by €1,204.50 on 2026-11-26. The allowed difference is €1.00.",
    };

function checksFor(asset: AssetDef): Check[] {
  const names: [string, string, "WARN" | "ERROR", boolean][] = [];
  const key = asset.key;
  if (asset.group === "core") {
    names.push([
      "unique_primary_key",
      "The primary key is unique.",
      "ERROR",
      true,
    ]);
    if (asset.name.startsWith("dim_"))
      names.push([
        "not_null_email",
        "Every row has an email address.",
        "WARN",
        false,
      ]);
    else
      names.push([
        "row_count_not_dropping",
        "The table does not lose rows between builds.",
        "WARN",
        false,
      ]);
  }
  if (asset.group === "marts_finance")
    names.push(["not_empty", "The table has rows.", "ERROR", true]);
  if (asset.name === "revenue_daily")
    names.push([
      "matches_stripe_payouts",
      "Daily revenue agrees with what Stripe paid out.",
      "ERROR",
      true,
    ]);
  if (asset.name === "churn_model")
    names.push([
      "auc_above_threshold",
      "AUC on held-out data is at least 0.80.",
      "ERROR",
      true,
    ]);
  const last = materializationsOf(key)[0];
  return names.map(([name, description, severity, blocking]) => {
    const detail = failedChecks[`${key}:${name}`];
    return {
      name,
      asset: key,
      description,
      severity,
      blocking,
      detail,
      status: detail
        ? "FAILED"
        : materializing.has(key)
          ? "IN_PROGRESS"
          : "SUCCEEDED",
      at: last?.at ?? ago(600),
    };
  });
}

export const checks: Check[] = assets.flatMap(checksFor);

/** Minutes within which an asset with a freshness policy must be rebuilt. */
const windows: Record<string, number> = {
  "marts_finance/revenue_daily": 26 * 60,
  "marts_finance/board_metrics": 26 * 60,
  "core/fct_invoices": 90,
  "core/fct_charges": 90,
  "marts_product/daily_active_users": 4 * 60,
  "raw_hubspot/hubspot_ad_spend": 8 * 60,
  "ml_models/churn_scores": 26 * 60,
};

export interface Partitions {
  keys: string[];
  materialized: number;
  failed: Set<string>;
  missing: Set<string>;
  materializing: Set<string>;
}

function days(from: Date, to: Date) {
  const made: string[] = [];
  for (let at = new Date(from); at <= to; at.setDate(at.getDate() + 1))
    made.push(isoDay(at));
  return made;
}

const partitionCache = new Map<string, Partitions>();

export function partitionsOf(key: string): Partitions | undefined {
  const asset = assetByKey.get(key);
  if (!asset?.partitioned) return undefined;
  const found = partitionCache.get(key);
  if (found) return found;
  const keys =
    asset.partitioned === "daily"
      ? days(new Date(2025, 0, 1), new Date(2026, 10, 26))
      : Array.from({ length: 34 }, (_, index) =>
          isoDay(new Date(2024, index, 1)).slice(0, 7),
        );
  const failed = new Set<string>();
  const missing = new Set<string>();
  const running = new Set<string>();
  const between = (from: string, to: string) =>
    keys.filter((item) => item >= from && item <= to);
  if (asset.name === "fct_product_events") {
    for (const item of between("2026-09-14", "2026-09-30")) missing.add(item);
    for (const item of ["2026-09-14", "2026-09-15"]) {
      missing.delete(item);
      running.add(item);
    }
  }
  if (asset.name === "fct_page_views" && !everythingHealthy)
    for (const item of ["2026-10-05", "2026-10-12", "2026-10-13"])
      failed.add(item);
  if (asset.name === "segment_screen_views")
    for (const item of between("2025-03-02", "2025-03-09")) missing.add(item);
  const made = {
    keys,
    failed,
    missing,
    materializing: running,
    materialized: keys.length - failed.size - missing.size - running.size,
  };
  partitionCache.set(key, made);
  return made;
}

export type AssetState =
  | "failed"
  | "materializing"
  | "stale"
  | "never"
  | "fresh";

export const assetStates: Record<AssetState, [label: string, tone: string]> = {
  failed: ["Failed", "failed"],
  materializing: ["Materializing", "running"],
  stale: ["Stale", "up_for_retry"],
  never: ["Never materialized", "none"],
  fresh: ["Materialized", "success"],
};

export interface AssetNow {
  def: AssetDef;
  state: AssetState;
  latest?: Materialization;
  /** The run of the latest attempt that failed. */
  failedRun?: Run;
  runningRun?: Run;
  staleCause?: string;
  checks: Check[];
  /** Set only for assets with a freshness policy. */
  freshness?: { passing: boolean; window: number };
}

export const catalog: AssetNow[] = assets.map((def) => {
  const latest = materializationsOf(def.key)[0];
  const attempt = attempts.get(def.key);
  // A backfill with a run in progress keeps its asset materializing.
  const runningRun =
    materializing.get(def.key) ??
    runs.find(
      (run) =>
        run.backfill &&
        run.status === "STARTED" &&
        run.selection.includes(def.key),
    );
  const failedRun = attempt && !attempt.ok ? attempt.run : undefined;
  const staleCause = staleCauses[def.key];
  const window = windows[def.key];
  return {
    def,
    latest,
    failedRun,
    runningRun,
    staleCause,
    state: runningRun
      ? "materializing"
      : failedRun
        ? "failed"
        : !latest
          ? "never"
          : staleCause
            ? "stale"
            : "fresh",
    checks: checks.filter((check) => check.asset === def.key),
    freshness: window
      ? {
          window,
          passing: Boolean(
            latest && NOW.getTime() - latest.at.getTime() <= window * 60_000,
          ),
        }
      : undefined,
  };
});

export const assetNow = new Map(catalog.map((item) => [item.def.key, item]));

export const failing = (item: AssetNow) =>
  item.checks.filter((check) => check.status === "FAILED");
