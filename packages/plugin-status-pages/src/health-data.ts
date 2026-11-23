import type { PluginContext } from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
export const DAY_MS = 86_400_000;
export const healthSchema = z.enum([
  "healthy",
  "warning",
  "unavailable",
  "unknown",
]);
export type Health = z.infer<typeof healthSchema>;
const counters = z.object({
  healthy: z.number().nonnegative(),
  warning: z.number().nonnegative(),
  unavailable: z.number().nonnegative(),
  unknown: z.number().nonnegative(),
  maintenance: z.number().nonnegative(),
});
export type Counters = z.infer<typeof counters>;
export const healthDataSchema = z.object({
  version: z.literal(1),
  services: z.array(
    z.object({
      id: z.string(),
      health: healthSchema,
      maintenance: z.boolean(),
      days: z.array(counters.extend({ time: z.number() })),
    }),
  ),
});
export type HealthData = z.infer<typeof healthDataSchema>;
export function mergeCounts(values: readonly Counters[]): Counters {
  const total = {
    healthy: 0,
    warning: 0,
    unavailable: 0,
    unknown: 0,
    maintenance: 0,
  };
  for (const value of values) {
    total.healthy += value.healthy;
    total.warning += value.warning;
    total.unavailable += value.unavailable;
    total.unknown += value.unknown;
    total.maintenance += value.maintenance;
  }
  return total;
}
export function availability(value: Counters): number | null {
  const measured = value.healthy + value.warning + value.unavailable;
  return measured ? ((value.healthy + value.warning) / measured) * 100 : null;
}
/** Health is an optional source. An installed but failing source is reported to the operator. */
export async function readHealth(
  context: Pick<PluginContext, "plugins" | "logger">,
): Promise<{ data: HealthData | undefined; error?: string }> {
  const plugin = await context.plugins.get("health");
  if (plugin?.status !== "ready") return { data: undefined };
  try {
    return {
      data: healthDataSchema.parse(
        await context.plugins.queryResource("health", "status-history", {}),
      ),
    };
  } catch (error) {
    context.logger.warn("Could not read Service health for status pages", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      data: undefined,
      error:
        "Automatic health data is temporarily unavailable. Notices remain available.",
    };
  }
}
