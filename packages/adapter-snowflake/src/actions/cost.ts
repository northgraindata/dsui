import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";
import { monitors } from "../resources/cost.js";

type Ctx = SnowflakeContext & ActionRuntimeContext;

const monitorInput = z.object({ name: z.string().min(1) });

export const suspendMonitor = defineAction({
  id: "suspend-monitor",
  input: monitorInput,
  run: async ({ name }, ctx: Ctx) => {
    await ctx.client.suspendMonitor(name);
    ctx.invalidate(monitors);
    return { name, status: "SUSPENDED" };
  },
});

export const resumeMonitor = defineAction({
  id: "resume-monitor",
  input: monitorInput,
  run: async ({ name }, ctx: Ctx) => {
    await ctx.client.resumeMonitor(name);
    ctx.invalidate(monitors);
    return { name, status: "ACTIVE" };
  },
});
