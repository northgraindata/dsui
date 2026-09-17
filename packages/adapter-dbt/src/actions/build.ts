import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DbtContext } from "../context.js";
import { archiveLocalRun } from "./archive.js";

export const runBuild = defineAction({
  id: "run-build",
  input: z.object({ jobId: z.string().min(1).optional() }),
  run: async (input, ctx: DbtContext & ActionRuntimeContext) => {
    if (ctx.local && ctx.config.method === "local") {
      const result = await ctx.local.execute("build", {}, ctx.signal);
      const runId = await archiveLocalRun(ctx.config, result, ctx);
      return { ...result, runId };
    }
    if (!ctx.cloud) throw new Error("Unsupported dbt connection");
    const jobId =
      input.jobId ??
      (ctx.config.method === "cloud" ? ctx.config.jobId : undefined) ??
      (await ctx.cloud.listJobs(ctx.signal))[0]?.id;
    if (!jobId)
      throw new Error("No dbt Cloud job is configured for this connection");
    const run = await ctx.cloud.triggerJob(
      jobId,
      { cause: "Triggered from DSUI", stepsOverride: ["dbt build"] },
      ctx.signal,
    );
    return { ...run, runId: run.id };
  },
});
