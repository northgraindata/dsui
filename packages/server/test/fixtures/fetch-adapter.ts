import {
  defineAdapter,
  definePage,
  defineResource,
  z,
} from "@northgraindata/dsui-adapter-sdk";

const schema = z.object({ url: z.string() });
type Config = z.infer<typeof schema>;

// A plain adapter: it calls fetch() on the configured address and knows
// nothing about DSUI agents or proxies.
const read = defineResource({
  id: "read",
  query: async (_input, ctx: Config) => {
    const response = await fetch(ctx.url);
    return { status: response.status, body: await response.text() };
  },
});

export default defineAdapter<Config, Config>({
  metadata: { id: "fetch-test", name: "Fetch test", version: "1.0.0" },
  connectionMethods: { direct: { label: "Direct", schema } },
  context: async (config) => config,
  health: async () => ({ status: "healthy", score: 100, checks: [] }),
  resources: [read],
  pages: [definePage({ path: "/", render: () => [] })],
});
