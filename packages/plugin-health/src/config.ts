import { z } from "zod";

/** How often the scheduler wakes to look for services that are due. */
export const SCHEDULER_TICK_MS = 15_000;

const serviceOverrideSchema = z.object({
  /** Probe interval for this service only. */
  intervalMs: z.number().int().min(10_000).max(86_400_000).optional(),
  /** Default availability target, as a percentage, before the UI sets one. */
  sloTarget: z.number().min(0).max(100).optional(),
  /** Window the target is measured over, in days. */
  sloWindowDays: z.number().int().min(1).max(90).optional(),
});

/**
 * Plugin configuration.
 *
 * Every field is optional. `checkIntervalMs` is the original name of
 * `defaultIntervalMs` and is still accepted so existing `dsui.yaml` files
 * keep loading; when both are present the newer name wins.
 */
export const configSchema = z
  .object({
    /** Interval between probes of one service unless overridden. */
    defaultIntervalMs: z.number().int().min(10_000).max(86_400_000).optional(),
    /** @deprecated Use `defaultIntervalMs`. */
    checkIntervalMs: z.number().int().min(10_000).max(86_400_000).optional(),
    /** Upper bound on a single probe, forwarded to the host. */
    timeoutMs: z.number().int().positive().max(60_000).default(30_000),
    /** Maximum services monitored. */
    maxServices: z.number().int().positive().max(5_000).default(500),
    /** Consecutive non-healthy results before a service leaves healthy. */
    failureThreshold: z.number().int().min(1).max(10).default(2),
    /** Consecutive healthy results before a service returns to healthy. */
    recoveryThreshold: z.number().int().min(1).max(10).default(2),
    /** Probes in flight at once across all adapters. */
    maxConcurrentProbes: z.number().int().min(1).max(64).default(8),
    /** Probes in flight at once against one adapter. */
    maxConcurrentProbesPerAdapter: z.number().int().min(1).max(16).default(2),
    /** Days of raw samples to keep. */
    rawRetentionDays: z.number().int().min(1).max(90).default(7),
    /** Days of daily rollups to keep. */
    rollupRetentionDays: z.number().int().min(30).max(1_000).default(400),
    /** A recovered incident reopens instead of a new one if it fails again this soon. */
    reopenWindowMinutes: z.number().int().min(0).max(1_440).default(10),
    /** Per-service overrides keyed by service id. */
    services: z.record(serviceOverrideSchema).default({}),
  })
  .transform((value) => ({
    ...value,
    defaultIntervalMs:
      value.defaultIntervalMs ?? value.checkIntervalMs ?? 300_000,
  }));

export type HealthConfig = z.infer<typeof configSchema>;

/** Probe interval for one service. */
export function intervalFor(config: HealthConfig, serviceId: string): number {
  return config.services[serviceId]?.intervalMs ?? config.defaultIntervalMs;
}
