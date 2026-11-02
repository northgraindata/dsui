import {
  healthReport,
  reachabilityCheck,
} from "@northgraindata/dsui-adapter-sdk";
import type { ShaperContext } from "./context.js";

/**
 * Reports the health of a Shaper server.
 *
 * `/health` proves the process is up, but it needs no credentials, so a wrong
 * API key would still look healthy. The schema call is the cheapest one that
 * requires a valid key, and its permission failure is reported as a degraded
 * check rather than as an outage.
 */
export async function shaperHealth(ctx: ShaperContext) {
  const started = Date.now();
  try {
    await ctx.client.health();
  } catch (error) {
    return healthReport({
      checks: [
        {
          ...reachabilityCheck(false),
          detail: error instanceof Error ? error.message : "Shaper unreachable",
        },
      ],
      weights: { reachability: 1 },
    });
  }

  const checks = [reachabilityCheck(true, Date.now() - started)];
  try {
    await ctx.client.getSchema();
    checks.push({
      id: "api-key",
      label: "API key",
      ok: true,
      detail: "Accepted",
    });
  } catch (error) {
    checks.push({
      id: "api-key",
      label: "API key",
      ok: false,
      detail: error instanceof Error ? error.message : "Rejected",
    });
  }

  return healthReport({
    checks,
    weights: { reachability: 1, "api-key": 1 },
    latencyMs: Date.now() - started,
  });
}
