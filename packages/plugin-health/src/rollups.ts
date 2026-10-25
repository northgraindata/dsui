import type { Health } from "./context.js";

export const HOUR_MS = 60 * 60_000;
export const DAY_MS = 24 * HOUR_MS;

export type Granularity = "hour" | "day";

/**
 * Upper edges of the latency histogram, in milliseconds.
 *
 * A fixed logarithmic scale lets percentiles be computed over weeks of data
 * from a few counters per bucket, without keeping every sample. The last
 * bucket is open ended.
 */
export const LATENCY_EDGES = [
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 30_000,
  60_000,
] as const;
export const LATENCY_BUCKETS = LATENCY_EDGES.length + 1;

export function emptyHistogram(): number[] {
  return Array.from({ length: LATENCY_BUCKETS }, () => 0);
}

export function latencyBucket(latencyMs: number): number {
  const index = LATENCY_EDGES.findIndex((edge) => latencyMs < edge);
  return index === -1 ? LATENCY_EDGES.length : index;
}

export function bucketStart(time: number, granularity: Granularity): number {
  const size = granularity === "hour" ? HOUR_MS : DAY_MS;
  return Math.floor(time / size) * size;
}

/** Counters for one service over one hour or day. */
export type Rollup = {
  healthy: number;
  warning: number;
  unavailable: number;
  unknown: number;
  /** Samples taken during maintenance; excluded from every other counter. */
  maintenance: number;
  latencyCount: number;
  latencySum: number;
  latencyMin: number | null;
  latencyMax: number | null;
  histogram: number[];
};

export function emptyRollup(): Rollup {
  return {
    healthy: 0,
    warning: 0,
    unavailable: 0,
    unknown: 0,
    maintenance: 0,
    latencyCount: 0,
    latencySum: 0,
    latencyMin: null,
    latencyMax: null,
    histogram: emptyHistogram(),
  };
}

/** Adds one sample to a rollup. */
export function addSample(
  rollup: Rollup,
  sample: { health: Health; latencyMs: number | null; maintenance: boolean },
): Rollup {
  if (sample.maintenance)
    return { ...rollup, maintenance: rollup.maintenance + 1 };
  const next: Rollup = {
    ...rollup,
    [sample.health]: rollup[sample.health] + 1,
  };
  if (sample.latencyMs !== null && sample.health !== "unknown") {
    const histogram = [...rollup.histogram];
    const index = latencyBucket(sample.latencyMs);
    histogram[index] = (histogram[index] ?? 0) + 1;
    next.histogram = histogram;
    next.latencyCount = rollup.latencyCount + 1;
    next.latencySum = rollup.latencySum + sample.latencyMs;
    next.latencyMin =
      rollup.latencyMin === null
        ? sample.latencyMs
        : Math.min(rollup.latencyMin, sample.latencyMs);
    next.latencyMax =
      rollup.latencyMax === null
        ? sample.latencyMs
        : Math.max(rollup.latencyMax, sample.latencyMs);
  }
  return next;
}

/** Sums rollups, for reading a range made of many buckets. */
export function mergeRollups(rollups: readonly Rollup[]): Rollup {
  const total = emptyRollup();
  for (const rollup of rollups) {
    total.healthy += rollup.healthy;
    total.warning += rollup.warning;
    total.unavailable += rollup.unavailable;
    total.unknown += rollup.unknown;
    total.maintenance += rollup.maintenance;
    total.latencyCount += rollup.latencyCount;
    total.latencySum += rollup.latencySum;
    if (rollup.latencyMin !== null)
      total.latencyMin =
        total.latencyMin === null
          ? rollup.latencyMin
          : Math.min(total.latencyMin, rollup.latencyMin);
    if (rollup.latencyMax !== null)
      total.latencyMax =
        total.latencyMax === null
          ? rollup.latencyMax
          : Math.max(total.latencyMax, rollup.latencyMax);
    rollup.histogram.forEach((count, index) => {
      total.histogram[index] = (total.histogram[index] ?? 0) + count;
    });
  }
  return total;
}

/**
 * Estimates a latency percentile from the histogram.
 *
 * Interpolates inside the bucket that contains the rank, so the answer is
 * exact to within one bucket's width. Returns `null` with no measurements.
 * The open last bucket reports its lower edge rather than inventing a bound.
 */
export function percentile(rollup: Rollup, fraction: number): number | null {
  const total = rollup.histogram.reduce((sum, count) => sum + count, 0);
  if (total === 0) return null;
  const rank = Math.max(1, Math.ceil(fraction * total));
  let seen = 0;
  for (let index = 0; index < rollup.histogram.length; index++) {
    const count = rollup.histogram[index] ?? 0;
    if (seen + count >= rank) {
      const lower = index === 0 ? 0 : (LATENCY_EDGES[index - 1] ?? 0);
      const upper = LATENCY_EDGES[index];
      if (upper === undefined) return lower;
      const within = count === 0 ? 0 : (rank - seen) / count;
      return lower + (upper - lower) * within;
    }
    seen += count;
  }
  return null;
}

export type Availability = {
  /** Share of measured samples in which the service was not unavailable. */
  availability: number | null;
  /** Share of measured samples that were fully healthy. */
  healthyShare: number | null;
  measured: number;
};

/**
 * Availability over a rollup.
 *
 * Unknown results are not measurements and maintenance samples are excluded,
 * so a stopped DSUI or a planned outage does not read as downtime. A degraded
 * (`warning`) service is still serving, so it counts as available here and is
 * reported separately through `healthyShare`.
 */
export function availabilityOf(rollup: Rollup): Availability {
  const measured = rollup.healthy + rollup.warning + rollup.unavailable;
  if (measured === 0)
    return { availability: null, healthyShare: null, measured };
  return {
    availability: ((rollup.healthy + rollup.warning) / measured) * 100,
    healthyShare: (rollup.healthy / measured) * 100,
    measured,
  };
}
