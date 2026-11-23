import {
  healthReport,
  reachabilityCheck,
} from "@northgraindata/dsui-adapter-sdk";
import type { DagsterContext } from "./context.js";

export async function dagsterHealth(ctx: DagsterContext) {
  const started = Date.now();
  try {
    const jobs = await ctx.client.listJobs();
    return healthReport({
      checks: [
        reachabilityCheck(true, Date.now() - started),
        {
          id: "repositories",
          label: "Jobs visible",
          ok: true,
          detail: `${jobs.length} jobs available`,
        },
      ],
      weights: { reachability: 1, repositories: 0 },
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    return healthReport({
      checks: [
        {
          ...reachabilityCheck(false),
          detail:
            error instanceof Error ? error.message : "Dagster unreachable",
        },
      ],
      weights: { reachability: 1 },
      latencyMs: Date.now() - started,
    });
  }
}
