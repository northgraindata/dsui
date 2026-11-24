import {
  definePlugin,
  defineResource,
  poll,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import { configSchema } from "./config.js";
import { statusPagesIconUrl } from "./logo.js";
import { statusPagesPage, statusPageView } from "./pages/index.js";
import { listServices } from "./services.js";
import {
  createStatusPage,
  deleteStatusPage,
  postStatusNotice,
  resolveStatusNotice,
  statusPage,
  statusPages,
  updateStatusNotice,
  updateStatusPage,
} from "./status-actions.js";
export default definePlugin({
  metadata: {
    id: "status-pages",
    name: "Status pages",
    version: "0.1.0",
    apiVersion: 1,
    category: "Monitoring",
    iconUrl: statusPagesIconUrl,
  },
  configSchema,
  setup(registry) {
    registry.resource(statusPages);
    registry.resource(statusPage);
    registry.resource(
      defineResource({
        id: "services",
        input: z.object({}).optional(),
        refresh: poll("30s"),
        query: async (_input, context) => ({
          items: await listServices(
            context.services,
            context.config.maxServices,
          ),
        }),
      }),
    );
    registry.action(createStatusPage);
    registry.action(updateStatusPage);
    registry.action(deleteStatusPage);
    registry.action(postStatusNotice);
    registry.action(updateStatusNotice);
    registry.action(resolveStatusNotice);
    registry.page(statusPagesPage, { id: "overview", title: "Status pages" });
    registry.page(statusPageView, { id: "page", title: "Status pages" });
    registry.navigation({
      id: "status-pages",
      area: "secondary",
      label: "Status pages",
      pageId: "overview",
      order: 51,
    });
  },
});
