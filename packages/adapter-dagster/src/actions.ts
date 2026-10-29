import {
  type ActionRuntimeContext,
  defineAction,
} from "@northgraindata/dsui-adapter-sdk";
import type { DagsterContext } from "./context.js";
import { jobInput, runInput } from "./resources.js";

type Ctx = DagsterContext & ActionRuntimeContext;

export const launchJob = defineAction({
  id: "launch-job",
  input: jobInput,
  run: async (input, ctx: Ctx) => {
    const runId = await ctx.client.launchJob(input, ctx.signal);
    ctx.invalidate();
    return { runId };
  },
});

export const terminateRun = defineAction({
  id: "terminate-run",
  input: runInput,
  run: async ({ runId }, ctx: Ctx) => {
    await ctx.client.terminateRun(runId, ctx.signal);
    ctx.invalidate();
    return { runId };
  },
});
