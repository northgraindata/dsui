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
const Service = defineComponent<{ serviceId: string }>({
  id: "health/service",
  path: "./browser.tsx",
});
export const overviewPage = definePage<"/health", HealthContext>({
  path: "/health",
  render: () => [Overview()],
});

export const servicePage = definePage<
  "/health/services/:serviceId",
  HealthContext
>({
  path: "/health/services/:serviceId",
  render: ({ params }) => [Service({ serviceId: params.serviceId })],
});
