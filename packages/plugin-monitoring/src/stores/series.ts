/** One reading, in the shape a chart point takes. */
export interface SeriesPoint {
  readonly time: number;
  readonly value: number;
}

/**
 * A series and the window it is being read over.
 *
 * `secs` is the display window. SQLite aggregates each window into roughly
 * 400 buckets without loading the full retained history into JavaScript.
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
