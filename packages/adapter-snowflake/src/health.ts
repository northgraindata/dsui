import {
  healthReport,
  reachabilityCheck,
} from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "./context.js";

export async function snowflakeHealth(ctx: SnowflakeContext) {
  const started = Date.now();
  try {
    const info = await ctx.client.serverInfo();
    return healthReport({
      checks: [
        reachabilityCheck(true, Date.now() - started),
        {
          id: "version",
          label: "Snowflake version",
          ok: true,
          detail: String(info.version),
        },
      ],
      weights: { reachability: 1, version: 0 },
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    return healthReport({
      checks: [
        {
          ...reachabilityCheck(false),
          detail:
            error instanceof Error ? error.message : "Snowflake unreachable",
        },
      ],
      weights: { reachability: 1 },
    });
  }
}
