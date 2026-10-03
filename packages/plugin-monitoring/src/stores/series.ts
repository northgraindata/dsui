/**
 * A host-metrics time series, stored in a persistent store.
 *
 * Sampling is one per second for every series, and the series keeps seven days
 * of history so the 7d, 24h, 1h and 5m windows all have something to draw.
 * A 7d window is 604 800 points per series, so the store retains them in full
 * and the resource averages on read: at day resolution that is eight points.
 */
import { defineStore } from "@northgraindata/dsui-plugin-sdk";
import type { CpuSample, DiskSample, MemorySample } from "../context.js";

/** One reading, in the shape a chart point takes. */
export interface SeriesPoint {
  readonly time: number;
  readonly value: number;
}

/**
 * A series and the window it is being read over.
 *
 * `secs` is the display window; the bucket it averages to is derived from it,
 * so 7d averages by day and 1h averages by minute. Choosing the bucket from
 * the window rather than storing three copies of the data is what keeps one
 * series enough for every view.
 */
export interface SeriesWindow {
  readonly label: string;
  readonly secs: number;
  /** Points returned after averaging. */
  readonly points: readonly SeriesPoint[];
  /** Samples behind the returned points, before averaging. */
  readonly sampleCount: number;
}

/** The windows offered by the monitoring overview. */
export const WINDOWS: readonly SeriesWindow[] = [
  { label: "5m", secs: 300, points: [], sampleCount: 0 },
  { label: "1h", secs: 3_600, points: [], sampleCount: 0 },
  { label: "24h", secs: 86_400, points: [], sampleCount: 0 },
  { label: "7d", secs: 604_800, points: [], sampleCount: 0 },
];

/** Seven days of one-second samples, per series. */
const RETAIN = 604_800;

function seriesStore(id: string, initial: readonly SeriesPoint[] = []) {
  return defineStore({
    id,
    persistence: { type: "persistent" as const, version: 1 },
    state: { points: initial as SeriesPoint[] },
    actions: ({ get, set }) => ({
      /** Records one reading, dropping anything past the retention window. */
      append: (value: number, time: number = Date.now()) =>
        set({
          points: [...get().points, { time, value }].slice(-RETAIN),
        }),
    }),
  });
}

/** Load average, one series so the axis has a single meaning. */
export const cpuSeries = seriesStore("host-cpu-load-series");

/** Memory used, in bytes. */
export const memorySeries = seriesStore("host-memory-series");

/** Percent used, which is what a chart can share an axis with. */
export const memoryPercentSeries = seriesStore("host-memory-percent-series");

/** Disk usage percent, averaged across the sampled volumes. */
export const diskPercentSeries = seriesStore("host-disk-percent-series");

/**
 * The bucket a window averages to, in milliseconds.
 *
 * One bucket per ~400 samples keeps every window at a readable point count: a
 * 5m window by 2.5 seconds, 1h by 9 seconds, 24h by 3.6 minutes, 7d by 25
 * minutes. The bucket is a whole number of seconds because a sub-second bucket
 * on a 1s sample series would collapse every window to a single point.
 */
function bucketFor(secs: number): number {
  return Math.max(1_000, Math.round(secs / 400) * 1_000);
}

/**
 * Reads a series over a window, averaging each bucket.
 *
 * Buckets are averaged rather than sampled so a spike inside a skipped span
 * still moves the line; sampling would hide exactly the event a reader opened
 * the window to find.
 */
export function readSeries(
  points: readonly SeriesPoint[],
  secs: number,
): SeriesWindow {
  const since = Date.now() - secs * 1000;
  const bucket = bucketFor(secs);
  const acc = new Map<number, { sum: number; count: number }>();
  let sampleCount = 0;
  for (const point of points) {
    if (point.time < since) continue;
    sampleCount += 1;
    const key = Math.floor(point.time / bucket) * bucket;
    const entry = acc.get(key);
    if (entry) {
      entry.sum += point.value;
      entry.count += 1;
    } else acc.set(key, { sum: point.value, count: 1 });
  }
  const averaged = [...acc]
    .map(([time, entry]) => ({ time, value: entry.sum / entry.count }))
    .sort((a, b) => a.time - b.time);
  const label =
    WINDOWS.find((window) => window.secs === secs)?.label ??
    `${Math.round(secs / 60)}m`;
  return { label, secs, points: averaged, sampleCount };
}

export type { CpuSample, DiskSample, MemorySample };
