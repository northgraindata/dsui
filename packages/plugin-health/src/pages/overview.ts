import {
  defineComponent,
  definePage,
  type PluginContext,
} from "@northgraindata/dsui-plugin-sdk";

const HealthOverview = defineComponent({
  id: "health/overview",
  path: "./browser.tsx",
});
export const healthOverviewPage = definePage<
  "/health",
  PluginContext<{ timeoutMs: number; maxServices: number }>
>({
  path: "/health",
  render: () => [HealthOverview()],
});
