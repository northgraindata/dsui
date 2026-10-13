import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import {
  type ActionRuntimeContext,
  defineAction,
  defineAdapter,
  defineJob,
  definePage,
  defineResource,
  defineStore,
  type ResourceRuntimeContext,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const schema = z.object({
  logPath: z.string(),
  label: z.string().default("default"),
});
type Config = z.infer<typeof schema>;
type Context = Config & { contextId: string };

const state = defineStore({
  id: "state",
  scope: "adapter",
  persistence: { type: "persistent" },
  state: { value: 0 },
  actions: ({ get, set }) => ({
    increment: () => set({ value: get().value + 1 }),
  }),
});
const stored = defineResource({
  id: "stored",
  query: (_input, ctx: Context & ResourceRuntimeContext) =>
    ctx.stores.get(state).get(),
});
const update = defineAction({
  id: "update",
  input: z.object({ delayMs: z.number().optional() }),
  run: async (input, ctx: Context & ActionRuntimeContext) => {
    await Bun.sleep(input.delayMs ?? 0);
    ctx.signal?.throwIfAborted();
    ctx.stores.get(state).actions.increment();
    return { pid: process.pid };
  },
});
const updateJob = defineJob<Context>({
  id: "update-job",
  intervalMs: 60_000,
  run: async ({ store }) => {
    store(state).actions.increment();
  },
});

const inspect = defineResource({
  id: "inspect",
  input: z.object({
    delayMs: z.number().optional(),
    crash: z.boolean().optional(),
    outputBytes: z.number().optional(),
  }),
  query: async (input, ctx: Context) => {
    if (input.crash) process.exit(7);
    await Bun.sleep(input.delayMs ?? 0);
    return {
      contextId: ctx.contextId,
      label: ctx.label,
      pid: process.pid,
      ...(input.outputBytes ? { payload: "x".repeat(input.outputBytes) } : {}),
    };
  },
});

export default defineAdapter<Context, Config>({
  metadata: { id: "retained-test", name: "Retained test", version: "1.0.0" },
  connectionMethods: {
    cached: { label: "Cached", schema, contextIdleTimeoutMs: 100 },
    request: { label: "Request", schema },
  },
  context: async (config) => {
    const contextId = randomUUID();
    appendFileSync(config.logPath, `open:${contextId}\n`);
    await Bun.sleep(30);
    return { ...config, contextId };
  },
  disposeContext: (ctx) => {
    appendFileSync(ctx.logPath, `close:${ctx.contextId}\n`);
  },
  health: async () => ({ status: "healthy", score: 100, checks: [] }),
  stores: [state],
  resources: [inspect, stored],
  actions: [update],
  jobs: [updateJob],
  pages: [definePage({ path: "/", render: () => [] })],
});
