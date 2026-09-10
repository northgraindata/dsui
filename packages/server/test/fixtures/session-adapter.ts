import {
  defineAction,
  defineAdapter,
  defineResource,
} from "@northgraindata/dsui-adapter-sdk";

const count = defineResource({
  id: "count",
  query: (_: undefined, ctx: { client: { count: number } }) => ctx.client.count,
});
const increment = defineAction({
  id: "increment",
  run: (_: undefined, ctx: { client: { count: number } }) => ++ctx.client.count,
});
export default defineAdapter({
  metadata: {
    id: "session-fixture",
    name: "Session fixture",
    version: "1.0.0",
  },
  context: () => ({ client: { count: 0 } }),
  resources: [count],
  actions: [increment],
});
