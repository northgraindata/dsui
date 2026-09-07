import {
  defineAction,
  defineAdapter,
  definePage,
  defineResource,
  PageHeader,
  Table,
} from "@northgraindata/dsui-adapter-sdk";

const things = defineResource({
  id: "things",
  query: () => [{ name: "alpha" }, { name: "beta" }],
});

const refresh = defineAction({
  id: "refresh",
  run: () => "refreshed",
});

const thingsPage = definePage({
  path: "/things",
  render: () => [PageHeader({ title: "Things" }), Table({ source: things() })],
});

export default defineAdapter({
  metadata: {
    id: "fixture",
    name: "Fixture",
    version: "1.0.0",
    description: "Minimal adapter for adapter-host tests.",
  },
  pages: [thingsPage],
  resources: [things],
  actions: [refresh],
});
