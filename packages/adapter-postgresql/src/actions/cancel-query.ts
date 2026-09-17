import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLContext } from "../context.js";
import { activity } from "../resources/activity.js";

export const cancelQuery = defineAction({
  id: "cancel-query",
  input: z.object({ pid: z.number().int().positive() }),
  run: async ({ pid }, ctx: PostgreSQLContext & ActionRuntimeContext) => {
    ctx.signal?.throwIfAborted();
    const cancelled = await ctx.client.cancelQuery(pid);
    ctx.invalidate(activity);
    return { pid, cancelled };
  },
});
