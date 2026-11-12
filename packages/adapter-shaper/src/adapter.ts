import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
import {
  createApp,
  deleteApp,
  updateApp,
  validateDashboard,
} from "./actions/apps.js";
import { exportDashboard } from "./actions/data.js";
import { shareDashboard } from "./actions/share.js";
import { runQuery } from "./actions/sql.js";
import { createShaperClient } from "./client.js";
import {
  createContext,
  type ShaperClient,
  type ShaperConfig,
  type ShaperHttpConfig,
  shaperConnectionSchema,
} from "./context.js";
import { shaperHealth } from "./health.js";
import { shaperJobs, shaperSignals, shaperStores } from "./jobs.js";
import { shaperIconUrl } from "./logo.js";
import {
  dashboardEditPage,
  dashboardNewPage,
  dashboardViewPage,
  taskEditPage,
  taskNewPage,
} from "./pages/apps.js";
import { dashboardListPage, taskListPage } from "./pages/lists.js";
import { overviewPage } from "./pages/overview.js";
import { queryPage } from "./pages/query.js";
import {
  app,
  dashboards,
  failingTasks,
  overview,
  recentDashboards,
  taskHealth,
  tasks,
  upcomingTasks,
} from "./resources/apps.js";
import { dashboard, dashboardSummary } from "./resources/dashboard.js";
import { databases, relations, schemas } from "./resources/schema.js";
import { sqlPreview } from "./resources/sql.js";

export function createShaperAdapter(
  createClient: (config: ShaperHttpConfig) => ShaperClient = createShaperClient,
) {
  return defineAdapter({
    metadata: {
      id: "shaper",
      name: "Shaper",
      version: "1.0.0",
      author: "DSUI",
      iconUrl: shaperIconUrl,
      description:
        "Browse, edit and operate Shaper dashboards, tasks and SQL over its API.",
    },
    connectionMethods: {
      api: {
        label: "API key",
        description:
          "Enter the Shaper server URL and an API key. Create the key in Shaper under API keys; it needs deploy, schema:read, data:query and jwt permissions. To share dashboards, also add the email and password of a Shaper user, because Shaper only lets signed-in users change sharing.",
        schema: shaperConnectionSchema,
        contextIdleTimeoutMs: 300_000,
      },
    },
    context: async (config: ShaperConfig) =>
      createContext(createClient(config), config),
    disposeContext: (ctx) => ctx.client.dispose(),
    latencyBudgetMs: 3_000,
    health: shaperHealth,
    jobs: shaperJobs,
    signals: shaperSignals,
    stores: shaperStores,
    resources: [
      overview,
      taskHealth,
      failingTasks,
      upcomingTasks,
      recentDashboards,
      dashboards,
      tasks,
      app,
      dashboard,
      dashboardSummary,
      sqlPreview,
      databases,
      schemas,
      relations,
    ],
    actions: [
      runQuery,
      createApp,
      updateApp,
      deleteApp,
      validateDashboard,
      exportDashboard,
      shareDashboard,
    ],
    pages: [
      overviewPage,
      dashboardListPage,
      dashboardNewPage,
      dashboardViewPage,
      dashboardEditPage,
      taskListPage,
      taskNewPage,
      taskEditPage,
      queryPage,
    ],
  });
}

export const shaperAdapter = createShaperAdapter();

export default shaperAdapter;
