import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DbtContext } from "../context.js";

export const cancelRun = defineAction({
  id: "cancel-run",
  input: z.object({ runId: z.string().min(1) }),
  run: async ({ runId }, ctx: DbtContext & ActionRuntimeContext) => {
    if (!ctx.cloud)
      throw new Error(
        "This action is available for dbt Cloud connections only",
      );
    return ctx.cloud.cancelRun(runId, ctx.signal);
  },
});
