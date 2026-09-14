import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { AirflowContext } from "../context.js";
import { dagInput } from "../resources/dags.js";
import { dagRunInput } from "../resources/runs.js";

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
    ctx.invalidate();
    return run;
  },
});

function pausedAction(id: string, isPaused: boolean) {
  return defineAction({
    id,
    input: dagInput,
    run: async ({ dagId }, ctx: Ctx) => {
      await ctx.client.setDagPaused(dagId, isPaused, ctx.signal);
      ctx.invalidate();
      return { dagId, isPaused };
    },
  });
}

export const pauseDag = pausedAction("pause-dag", true);
export const unpauseDag = pausedAction("unpause-dag", false);

export const terminateDagRun = defineAction({
  id: "terminate-dag-run",
  input: dagRunInput,
  run: async ({ dagId, dagRunId }, ctx: Ctx) => {
    const run = await ctx.client.setDagRunState(
      dagId,
      dagRunId,
      "failed",
      ctx.signal,
    );
    ctx.invalidate();
    return run;
  },
});
