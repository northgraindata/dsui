import {
  type ActionRuntimeContext,
  Button,
  defineAction,
  defineAdapter,
  definePage,
  defineResource,
  KeyValue,
  PageHeader,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const connectionSchema = z.object({
  endpoint: z.string().url(),
  token: z.string().min(1),
});

type Context = {
  endpoint: string;
  token: string;
  request: typeof fetch;
};

export const info = defineResource({
  id: "info",
  query: (_, ctx: Context) => ({
    endpoint: ctx.endpoint,
    status: "reachable",
  }),
});

export const ping = defineAction({
  id: "ping",
  run: async (_, ctx: Context & ActionRuntimeContext) => {
    const response = await ctx.request(`${ctx.endpoint}/health`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    ctx.invalidate(info);
    return { ok: response.ok };
  },
});

export const overviewPage = definePage({
  path: "/",
  render: () => [
    PageHeader({ title: "Example Service" }),
    KeyValue({ source: info() }),
    Button({ label: "Ping", action: ping() }),
  ],
});

export default defineAdapter({
  metadata: {
    id: "example-service",
    name: "Example Service",
    version: "0.1.0",
    description: "An example dsui adapter.",
  },
  connectionSchema,
  context: (config) => ({
    endpoint: config.endpoint,
    token: config.token,
    request: fetch,
  }),
  resources: [info],
  actions: [ping],
  pages: [overviewPage],
});
