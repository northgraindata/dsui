import type {
  CardBadgeTone,
  GaugeTone,
  PluginServiceProbe,
} from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";

export const healthSchema = z.enum([
  "healthy",
  "warning",
  "unavailable",
  "unknown",
]);
export type Health = z.infer<typeof healthSchema>;

export const probeSchema = z.object({
  id: z.string(),
  health: healthSchema,
  detail: z.string().optional(),
  latencyMs: z.number().optional(),
  score: z.number().optional(),
  checks: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        ok: z.boolean(),
        detail: z.string().optional(),
      }),
    )
    .optional(),
});
/**
 * A probe as returned by the host.
 *
 * Aliased to the SDK type rather than re-derived from the Zod schema: the two
 * must not drift, and the SDK type is what the host contract guarantees.
 */
export type Probe = PluginServiceProbe;

export const serviceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  adapter: z.string(),
  iconUrl: z.string().optional(),
  managedBy: z.enum(["configuration", "ui"]),
});
export type ServiceSummary = z.infer<typeof serviceSummarySchema>;

export type ProbeResult = ServiceSummary & Probe;

/**
 * Upper bound on concurrent outbound probes.
 *
 * Probing reaches external systems, so a large estate must not open an
 * unbounded number of connections at once. The limit is deliberately a
 * property of the plugin rather than the host: the host exposes the probe,
 * this plugin decides how aggressively to use it.
 */
export const MAX_CONCURRENT_PROBES = 8;

/**
 * Probes many services with bounded concurrency.
 *
 * One unreachable host must not serialize the whole dashboard, so probes run
 * in parallel up to the cap. A probe that throws is reported as unavailable
 * rather than rejected: one broken service should not fail a batch that also
 * contains healthy ones.
 */
export async function probeServices(
  probe: (id: string) => Promise<Probe | null>,
  services: readonly ServiceSummary[],
): Promise<Map<string, Probe>> {
  const results = new Map<string, Probe>();
  let cursor = 0;
  const worker = async () => {
    while (cursor < services.length) {
      const service = services[cursor++];
      if (!service) return;
      try {
        const result = await probe(service.id);
        if (result) results.set(service.id, result);
      } catch {
        results.set(service.id, {
          id: service.id,
          health: "unavailable",
          detail: "Health probe failed",
        });
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_PROBES, services.length) },
      worker,
    ),
  );
  return results;
}

/** Joins service identity with its probe result for rendering. */
export function joinProbes(
  services: readonly ServiceSummary[],
  probes: ReadonlyMap<string, Probe>,
): ProbeResult[] {
  return services.map((service) => {
    const probe = probes.get(service.id);
    return {
      ...service,
      ...(probe ?? { health: "unknown" as Health, detail: "No health result" }),
    };
  });
}

export function countHealth(
  results: readonly ProbeResult[],
): Record<Health, number> {
  const counts: Record<Health, number> = {
    healthy: 0,
    warning: 0,
    unavailable: 0,
    unknown: 0,
  };
  for (const result of results) counts[result.health] += 1;
  return counts;
}

/**
 * Maps health onto the shared badge tone vocabulary.
 *
 * `unknown` maps to `info` rather than to a warning or healthy tone: an
 * absent measurement must not read as either a problem or a pass, and
 * `muted` is not part of the shared badge tone vocabulary.
 */
export function toneFor(
  health: Health,
): "healthy" | "warning" | "unavailable" | "info" | undefined {
  switch (health) {
    case "healthy":
      return "healthy";
    case "warning":
      return "warning";
    case "unavailable":
      return "unavailable";
    case "unknown":
      return undefined;
  }
}

/**
 * Tone for the score ring.
 *
 * An unscored or unknown service gets no tone rather than a neutral-looking
 * one: a ring that reads as "muted" is still a ring that looks like a
 * measurement.
 */
export function gaugeTone(probe: ProbeResult): GaugeTone {
  const tone = toneFor(probe.health);
  return tone ?? "muted";
}

/** Badge tone for prose, which does have a neutral option. */
export function badgeTone(probe: ProbeResult): CardBadgeTone {
  return toneFor(probe.health) ?? "info";
}

/** Human-readable latency/detail line shared by pages and slots. */
export function describeProbe(probe: Probe): string {
  if (probe.latencyMs !== undefined)
    return `${probe.latencyMs} ms response time`;
  return probe.detail ?? "No additional detail";
}
