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
const StatusPages = defineComponent({
  id: "health/status-pages",
  path: "./browser.tsx",
});
const StatusPage = defineComponent<{ slug: string }>({
  id: "health/status-page",
  path: "./browser.tsx",
});

export const overviewPage = definePage<"/health", HealthContext>({
  path: "/health",
  render: () => [Overview()],
});

export const statusPagesPage = definePage<
  "/health/status-pages",
  HealthContext
>({
  path: "/health/status-pages",
  render: () => [StatusPages()],
});

export const statusPageView = definePage<
  "/health/status-pages/:slug",
  HealthContext
>({
  path: "/health/status-pages/:slug",
  render: ({ params }) => [StatusPage({ slug: params.slug })],
});
