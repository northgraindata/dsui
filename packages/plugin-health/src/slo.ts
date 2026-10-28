import type { Database } from "bun:sqlite";
import type { HealthConfig } from "./config.js";
import { readRollups } from "./repo.js";
import {
  availabilityOf,
  DAY_MS,
  mergeRollups,
  percentile,
  type Rollup,
} from "./rollups.js";

export type SloTarget = {
  serviceId: string;
  targetPercent: number;
  windowDays: number;
  source: "configuration" | "ui";
};

const DEFAULT_WINDOW_DAYS = 30;

/** The target in effect: set in the UI, else the configured default. */
export function readSlo(
  db: Database,
  config: HealthConfig,
  serviceId: string,
): SloTarget | null {
  const row = db
    .query<{ target_percent: number; window_days: number }, [string]>(
      "SELECT target_percent, window_days FROM slo_targets WHERE service_id = ?",
    )
    .get(serviceId);
  if (row)
    return {
      serviceId,
      targetPercent: row.target_percent,
      windowDays: row.window_days,
      source: "ui",
    };
  const configured = config.services[serviceId];
  if (configured?.sloTarget === undefined) return null;
  return {
    serviceId,
    targetPercent: configured.sloTarget,
    windowDays: configured.sloWindowDays ?? DEFAULT_WINDOW_DAYS,
    source: "configuration",
  };
}

export function writeSlo(
  db: Database,
  input: {
    serviceId: string;
    targetPercent: number;
    windowDays: number;
    actor: string;
  },
  now: number,
): void {
  db.query(
    `INSERT OR REPLACE INTO slo_targets (service_id, target_percent, window_days, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    input.serviceId,
    input.targetPercent,
    input.windowDays,
    input.actor,
    now,
  );
}

/** Removes the UI override, falling back to configuration. */
export function clearSlo(db: Database, serviceId: string): void {
  db.query("DELETE FROM slo_targets WHERE service_id = ?").run(serviceId);
}

function remainingOf(budgetPercent: number, consumedPercent: number): number {
  // A 100 percent target has no budget: any failure overspends it.
  if (budgetPercent === 0) return consumedPercent === 0 ? 1 : -1;
  return 1 - consumedPercent / budgetPercent;
}

export type ErrorBudget = {
  targetPercent: number;
  windowDays: number;
  availability: number | null;
  /** Allowed failing share of measured samples, as a percentage. */
  budgetPercent: number;
  /** Failing share so far, as a percentage. */
  consumedPercent: number | null;
  /** Share of the budget still available; negative once exceeded. */
  remainingFraction: number | null;
  met: boolean | null;
};

/**
 * Error budget for an availability target.
 *
 * A 99.9% target allows 0.1% of measured samples to fail. `remainingFraction`
 * is how much of that allowance is left: 1 untouched, 0 spent, negative once
 * the target is missed.
 */
export function errorBudget(
  rollup: Rollup,
  target: Pick<SloTarget, "targetPercent" | "windowDays">,
): ErrorBudget {
  const { availability } = availabilityOf(rollup);
  const budgetPercent = 100 - target.targetPercent;
  if (availability === null)
    return {
      targetPercent: target.targetPercent,
      windowDays: target.windowDays,
      availability,
      budgetPercent,
      consumedPercent: null,
      remainingFraction: null,
      met: null,
    };
  const consumedPercent = 100 - availability;
  return {
    targetPercent: target.targetPercent,
    windowDays: target.windowDays,
    availability,
    budgetPercent,
    consumedPercent,
    remainingFraction: remainingOf(budgetPercent, consumedPercent),
    met: availability >= target.targetPercent,
  };
}

export type RangeStats = {
  days: number;
  availability: number | null;
  healthyShare: number | null;
  measured: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  averageLatencyMs: number | null;
};

/** Ranges shown on the detail page. */
export const RANGES = [1, 7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

/**
 * Statistics for one service over the last `days`.
 *
 * Ranges up to a week read hourly rollups; longer ranges read daily ones, so
 * a 90 day question touches at most 91 rows.
 */
export function rangeStats(
  db: Database,
  serviceId: string,
  days: number,
  now: number,
): RangeStats {
  const rollup = rangeRollup(db, serviceId, days, now);
  const { availability, healthyShare, measured } = availabilityOf(rollup);
  return {
    days,
    availability,
    healthyShare,
    measured,
    p50: percentile(rollup, 0.5),
    p95: percentile(rollup, 0.95),
    p99: percentile(rollup, 0.99),
    averageLatencyMs:
      rollup.latencyCount === 0
        ? null
        : rollup.latencySum / rollup.latencyCount,
  };
}

export function rangeRollup(
  db: Database,
  serviceId: string,
  days: number,
  now: number,
): Rollup {
  const granularity = days <= 7 ? "hour" : "day";
  const from = now - days * DAY_MS;
  return mergeRollups([
    ...readRollups(db, serviceId, granularity, from, now).values(),
  ]);
}
