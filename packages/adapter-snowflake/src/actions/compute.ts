import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";
import { computePools } from "../resources/compute.js";

type Ctx = SnowflakeContext & ActionRuntimeContext;

const poolInput = z.object({ name: z.string().min(1) });

export const suspendComputePool = defineAction({
  id: "suspend-compute-pool",
  input: poolInput,
  run: async ({ name }, ctx: Ctx) => {
    await ctx.client.suspendComputePool(name);
    ctx.invalidate(computePools);
    return { name, status: "SUSPENDED" };
  },
});

export const resumeComputePool = defineAction({
  id: "resume-compute-pool",
  input: poolInput,
  run: async ({ name }, ctx: Ctx) => {
    await ctx.client.resumeComputePool(name);
    ctx.invalidate(computePools);
    return { name, status: "ACTIVE" };
  },
});
