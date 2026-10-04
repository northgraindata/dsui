import {
  definePage,
  type PluginContext,
  Section,
} from "@northgraindata/dsui-plugin-sdk";
import { healthTable } from "../components/health-panel.js";
import { type HealthSummary, serviceHealth } from "../resources/health.js";

type HealthConfig = { timeoutMs: number; maxServices: number };

export const healthOverviewPage = definePage<
  "/health",
  PluginContext<HealthConfig>
>({
  path: "/health",
  render: async ({ resource }) => {
    const { items } = (await resource(serviceHealth)) as HealthSummary;
    return [
      Section({
        title: "Services",
        description: "Status and response time for configured services.",
        content: healthTable(items),
      }),
    ];
  },
});
