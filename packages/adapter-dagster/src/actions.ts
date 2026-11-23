import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DagsterContext } from "./context.js";
import { assetInput, jobInput, runInput } from "./resources.js";

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

export const materializeAsset = defineAction({
  id: "materialize-asset",
  input: assetInput,
  run: async ({ id }, ctx: Ctx) => {
    const asset = (await ctx.client.listAssets(ctx.signal)).find(
      (item) => item.id === id,
    );
    if (!asset) throw new Error("Dagster asset was not found");
    if (!asset.isMaterializable)
      throw new Error(
        `${asset.name} is a source asset and cannot be materialized`,
      );
    const runId = await ctx.client.materializeAssets(
      asset,
      [asset.path],
      ctx.signal,
    );
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

const instigatorInput = z.object({
  repositoryLocationName: z.string().min(1),
  repositoryName: z.string().min(1),
  name: z.string().min(1),
  stateId: z.string().min(1),
});

function toggle(id: string, kind: "schedule" | "sensor", running: boolean) {
  return defineAction({
    id,
    input: instigatorInput,
    run: async (input, ctx: Ctx) => {
      if (kind === "schedule")
        await ctx.client.setScheduleRunning(input, running, ctx.signal);
      else await ctx.client.setSensorRunning(input, running, ctx.signal);
      ctx.invalidate();
      return { name: input.name };
    },
  });
}

export const startSchedule = toggle("start-schedule", "schedule", true);
export const stopSchedule = toggle("stop-schedule", "schedule", false);
export const startSensor = toggle("start-sensor", "sensor", true);
export const stopSensor = toggle("stop-sensor", "sensor", false);
