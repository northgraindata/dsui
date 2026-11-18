import { z } from "zod";
import { healthSchema } from "./context.js";

export const HISTORY_WINDOW_MS = 7 * 24 * 60 * 60_000;
export const HISTORY_BUCKET_MS = 60 * 60_000;
export const HISTORY_RETENTION_MS = HISTORY_WINDOW_MS;
export const historyPointSchema = z.object({
  time: z.number().finite(),
  health: healthSchema,
  latencyMs: z.number().finite().nonnegative().nullable(),
});
export type HistoryPoint = z.infer<typeof historyPointSchema>;
export interface HealthBucket {
  time: number;
  health: HistoryPoint["health"] | null;
  samples: number;
  latencyMs: number | null;
}
const severity = { healthy: 0, unknown: 1, warning: 2, unavailable: 3 };

/** Missing hours stay empty; a short failure must survive aggregation. */
export function bucketHistory(
  points: readonly HistoryPoint[],
  now: number,
): HealthBucket[] {
  const end = Math.floor(now / HISTORY_BUCKET_MS) * HISTORY_BUCKET_MS;
  const first = end - HISTORY_WINDOW_MS + HISTORY_BUCKET_MS;
  const buckets: HealthBucket[] = Array.from(
    { length: HISTORY_WINDOW_MS / HISTORY_BUCKET_MS },
    (_, index) => ({
      time: first + index * HISTORY_BUCKET_MS,
      health: null,
      samples: 0,
      latencyMs: null,
    }),
  );
  const latencyCounts = Array.from(
    { length: HISTORY_WINDOW_MS / HISTORY_BUCKET_MS },
    () => 0,
  );
  for (const point of points) {
    if (point.time > now) continue;
    const index = Math.floor((point.time - first) / HISTORY_BUCKET_MS);
    const bucket = buckets[index];
    if (!bucket) continue;
    if (
      bucket.health === null ||
      severity[point.health] > severity[bucket.health]
    )
      bucket.health = point.health;
    bucket.samples++;
    if (point.latencyMs !== null) {
      const count = latencyCounts[index]++;
      bucket.latencyMs =
        ((bucket.latencyMs ?? 0) * count + point.latencyMs) / (count + 1);
    }
  }
  return buckets;
}
