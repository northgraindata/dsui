import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
import { launchJob, terminateRun } from "./actions.js";
import { createDagsterClient } from "./client.js";
import {
  type DagsterConfig,
  dagsterBasicConnectionSchema,
  dagsterConnectionSchema,
  dagsterPlusConnectionSchema,
} from "./context.js";
import { dagsterHealth } from "./health.js";
import { dagsterIconUrl } from "./logo.js";
import {
  assetPage,
  assetsPage,
  jobPage,
  jobsPage,
  overviewPage,
  runPage,
  runsPage,
} from "./pages.js";
import {
  assetDetails,
  assetDownstream,
  assets,
  assetUpstream,
  jobDetails,
  jobRuns,
  jobSteps,
  jobs,
  overview,
  runDetails,
  runLogs,
  runs,
} from "./resources.js";

export const dagsterAdapter = defineAdapter({
  metadata: {
    id: "dagster",
    name: "Dagster",
    version: "0.1.0",
    author: "DSUI",
    iconUrl: dagsterIconUrl,
    description: "Browse Dagster assets, lineage, jobs, and runs.",
  },
  connectionMethods: {
    dagster: {
      label: "Open source",
      description: "Connect to a Dagster webserver without API authentication.",
      schema: dagsterConnectionSchema,
      contextIdleTimeoutMs: 300_000,
    },
    "dagster-basic": {
      label: "Self-hosted (Basic auth)",
      description:
        "Connect through a reverse proxy that requires HTTP Basic authentication.",
      schema: dagsterBasicConnectionSchema,
      contextIdleTimeoutMs: 300_000,
    },
    "dagster-plus": {
      label: "Dagster+",
      description: "Enter your deployment URL and a Dagster+ user API token.",
      schema: dagsterPlusConnectionSchema,
      contextIdleTimeoutMs: 300_000,
    },
  },
  context: async (config: DagsterConfig) => ({
    client: createDagsterClient(config),
  }),
  latencyBudgetMs: 3_000,
  health: dagsterHealth,
  resources: [
    assets,
    assetDetails,
    assetUpstream,
    assetDownstream,
    overview,
    jobs,
    jobDetails,
    jobSteps,
    runs,
    jobRuns,
    runDetails,
    runLogs,
  ],
  actions: [launchJob, terminateRun],
  pages: [
    overviewPage,
    assetsPage,
    assetPage,
    jobsPage,
    jobPage,
    runsPage,
    runPage,
  ],
});

export default dagsterAdapter;
