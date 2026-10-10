import {
  defineAdapter,
  healthReport,
  reachabilityCheck,
} from "@northgraindata/dsui-adapter-sdk";
import { actions, signals } from "./actions/index.js";
import { type Config, connectionSchema } from "./config.js";
import { createContext, type TrinoContext } from "./context.js";
import { activityPage } from "./pages/activity.js";
import { catalogPage } from "./pages/catalog.js";
import { explorerPage } from "./pages/explorer.js";
import { overviewPage } from "./pages/overview.js";
import { queryPage } from "./pages/query.js";
import { queryDetailsPage } from "./pages/query-details.js";
import { relationPage } from "./pages/relation.js";
import { schemaPage } from "./pages/schema.js";
import { workerPage } from "./pages/worker.js";
import { workersPage } from "./pages/workers.js";
import { resources } from "./resources/index.js";

const pages = [
  overviewPage,
  activityPage,
  queryDetailsPage,
  queryPage,
  explorerPage,
  catalogPage,
  schemaPage,
  relationPage,
  workersPage,
  workerPage,
];

export default defineAdapter<TrinoContext, Config>({
  metadata: {
    id: "trino",
    name: "Trino",
    version: "0.1.0",
    author: "DSUI",
    description:
      "Explore Trino catalogs, run SQL and monitor distributed query execution.",
    iconUrl: "https://trino.io/assets/images/trino-logo/trino-ko_tiny-alt.svg",
  },
  connectionMethods: {
    trino: {
      label: "Trino coordinator",
      description:
        "Connect with a username, HTTPS password or JWT. SQL and monitoring permissions are checked separately.",
      schema: connectionSchema,
    },
  },
  context: createContext,
  disposeContext: (ctx) => ctx.client.dispose(),
  latencyBudgetMs: 1000,
  health: async (ctx) => {
    const start = Date.now();
    try {
      const result = await ctx.client.health();
      let monitoring = "Available";
      let monitorOk = true;
      try {
        await ctx.client.ui("cluster");
      } catch (error) {
        monitorOk = false;
        monitoring = error instanceof Error ? error.message : "Unavailable";
      }
      return healthReport({
        checks: [
          reachabilityCheck(true, Date.now() - start),
          {
            id: "version",
            label: "Server version",
            ok: true,
            detail: String(result.rows[0]?.version ?? ""),
          },
          {
            id: "monitoring",
            label: "Monitoring access",
            ok: monitorOk,
            detail: monitoring,
          },
        ],
        weights: { reachability: 1, version: 0, monitoring: 0 },
      });
    } catch (error) {
      return healthReport({
        checks: [
          {
            ...reachabilityCheck(false),
            detail:
              error instanceof Error ? error.message : "Trino unavailable",
          },
        ],
        weights: { reachability: 1 },
      });
    }
  },
  resources,
  actions,
  signals,
  pages,
});
