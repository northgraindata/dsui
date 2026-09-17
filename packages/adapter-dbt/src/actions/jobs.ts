import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DbtContext } from "../context.js";

export const triggerJobInput = z.object({
  jobId: z.string().min(1),
  cause: z.string().min(1).default("Triggered from DSUI"),
  stepsOverride: z.array(z.string().min(1)).optional(),
});

export const triggerJob = defineAction({
  id: "trigger-job",
  input: triggerJobInput,
  run: async (input, ctx: DbtContext & ActionRuntimeContext) => {
    if (!ctx.cloud)
      throw new Error(
        "This action is available for dbt Cloud connections only",
      );
    return ctx.cloud.triggerJob(input.jobId, input, ctx.signal);
  },
});
