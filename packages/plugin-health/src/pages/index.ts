import {
  defineComponent,
  definePage,
  type PluginContext,
} from "@northgraindata/dsui-plugin-sdk";
import type { HealthConfig } from "../config.js";

type HealthContext = PluginContext<HealthConfig>;

const Overview = defineComponent({
  id: "health/overview",
  path: "./browser.tsx",
});
export const overviewPage = definePage<"/health", HealthContext>({
  path: "/health",
  render: () => [Overview()],
});
