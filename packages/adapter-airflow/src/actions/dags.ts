import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext } from "../context.js";
import { dagDetails, dagInput, dags } from "../resources/dags.js";
import { dagRuns } from "../resources/runs.js";

type Ctx = AirflowContext & ActionRuntimeContext;

export const triggerDagInput = dagInput.extend({
  conf: z.record(z.string(), z.unknown()).default({}),
});

export const triggerDag = defineAction({
  id: "trigger-dag",
  input: triggerDagInput,
  run: async ({ dagId, conf }, ctx: Ctx) => {
    const dag = await ctx.client.getDag(dagId, ctx.signal);
    if (dag.isPaused) await ctx.client.setDagPaused(dagId, false, ctx.signal);
    const run = await ctx.client.triggerDag(dagId, conf, ctx.signal);
    ctx.invalidate(dags);
    ctx.invalidate(dagRuns, { dagId });
    ctx.invalidate(dagDetails, { dagId });
    return run;
  },
});

function pausedAction(id: string, isPaused: boolean) {
  return defineAction({
    id,
    input: dagInput,
    run: async ({ dagId }, ctx: Ctx) => {
      await ctx.client.setDagPaused(dagId, isPaused, ctx.signal);
      ctx.invalidate(dags);
      ctx.invalidate(dagDetails, { dagId });
      return { dagId, isPaused };
    },
  });
}

export const pauseDag = pausedAction("pause-dag", true);
export const unpauseDag = pausedAction("unpause-dag", false);
