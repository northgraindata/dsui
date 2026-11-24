import {
  defineComponent,
  definePage,
  type PluginContext,
} from "@northgraindata/dsui-plugin-sdk";
import type { StatusConfig } from "../config.js";

type StatusContext = PluginContext<StatusConfig>;

const StatusPages = defineComponent({
  id: "status-pages/overview",
  path: "./browser.tsx",
});
const StatusPage = defineComponent<{ slug: string }>({
  id: "status-pages/page",
  path: "./browser.tsx",
});

export const statusPagesPage = definePage<"/overview", StatusContext>({
  path: "/overview",
  render: () => [StatusPages()],
});

export const statusPageView = definePage<"/pages/:slug", StatusContext>({
  path: "/pages/:slug",
  render: ({ params }) => [StatusPage({ slug: params.slug })],
});
