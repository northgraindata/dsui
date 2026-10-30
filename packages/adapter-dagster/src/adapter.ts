import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
import {
  launchJob,
  materializeAsset,
  startSchedule,
  startSensor,
  stopSchedule,
  stopSensor,
  terminateRun,
} from "./actions.js";
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
  automationPage,
  jobPage,
  jobsPage,
  lineagePage,
  overviewPage,
  runPage,
  runsPage,
} from "./pages.js";
import {
  assetChecks,
  assetDetails,
  assetDownstream,
  assetGraph,
  assetHistory,
  assetJobs,
  assetLineage,
  assets,
  assetUpstream,
  jobAssets,
  jobDetails,
  jobGraph,
  jobRuns,
  jobs,
  overview,
  runAssets,
  runDetails,
  runGraph,
  runLogs,
  runs,
  schedules,
  sensors,
} from "./resources.js";

export const dagsterAdapter = defineAdapter({
  metadata: {
    id: "dagster",
    name: "Dagster",
    version: "0.1.0",
    author: "DSUI",
    iconUrl: dagsterIconUrl,
    description:
      "Browse Dagster asset lineage, checks, jobs, automation, and runs.",
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
    assetGraph,
    assetDetails,
    assetLineage,
    assetUpstream,
    assetDownstream,
    assetChecks,
    assetHistory,
    assetJobs,
    overview,
    jobs,
    jobDetails,
    jobGraph,
    jobAssets,
    runs,
    jobRuns,
    runDetails,
    runGraph,
    runAssets,
    runLogs,
    schedules,
    sensors,
  ],
  actions: [
    launchJob,
    materializeAsset,
    terminateRun,
    startSchedule,
    stopSchedule,
    startSensor,
    stopSensor,
  ],
  pages: [
    overviewPage,
    lineagePage,
    assetsPage,
    assetPage,
    jobsPage,
    jobPage,
    automationPage,
    runsPage,
    runPage,
  ],
});

export default dagsterAdapter;
