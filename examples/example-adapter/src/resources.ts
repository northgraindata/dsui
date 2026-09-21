import {
  defineAction,
  defineResource,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { ExampleContext } from "./context.js";

/** External data: read-only and managed by the runtime. */
export const status = defineResource({
  id: "status",
  query: async (_input: undefined, ctx: ExampleContext) => ({
    url: ctx.config.baseUrl,
    ok: true,
  }),
});

/** Behavior: a mutation or side effect. */
export const ping = defineAction({
  id: "ping",
  input: z.object({ note: z.string().optional() }),
  run: async ({ note }, _ctx: ExampleContext) => ({
    pong: true,
    note: note ?? null,
  }),
});
