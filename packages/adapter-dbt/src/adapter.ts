import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
import { runBuild } from "./actions/build.js";
import { triggerJob } from "./actions/jobs.js";
import { execute } from "./actions/local.js";
import { cancelRun } from "./actions/runs.js";
import { createContext, dbtConnectionMethods } from "./context.js";
import { artifactDetailPage, artifactsPage } from "./pages/artifacts.js";
import { sourcesPage, testsPage } from "./pages/catalog.js";
import { jobsPage, projectsPage } from "./pages/cloud.js";
import { modelDetailPage } from "./pages/model-detail.js";
import { modelsPage } from "./pages/models.js";
import { overviewPage } from "./pages/overview.js";
import { runDetailPage } from "./pages/run-detail.js";
import { runsPage } from "./pages/runs.js";
import {
  artifactDetail,
  artifacts,
  modelColumns,
  modelDetail,
  modelLineage,
  models,
  runGraph,
} from "./resources/artifacts.js";
import { sources, tests } from "./resources/catalog.js";
import { jobs, projects } from "./resources/cloud.js";
import { dashboard, recentRuns } from "./resources/dashboard.js";
import {
  catalogRelations,
  freshnessRows,
  graphSummaryRows,
  manifestOverview,
  osiOverview,
  runResultRows,
  runResultsOverview,
  semanticMetrics,
  semanticModels,
  semanticOverview,
  semanticSavedQueries,
} from "./resources/explorers.js";
import { overview } from "./resources/overview.js";
import { runArtifacts, runDetail, runLogs } from "./resources/run-detail.js";
import { runs } from "./resources/runs.js";
import { dbtRunStore } from "./stores/runs.js";

export function createDbtAdapter() {
  return defineAdapter({
    metadata: {
      id: "dbt",
      name: "dbt",
      version: "0.1.0",
      author: "DSUI",
      description: "Browse and operate dbt Cloud and local projects.",
      iconUrl:
        "https://images.seeklogo.com/logo-png/43/2/dbt-logo-png_seeklogo-431111.png",
    },
    connectionMethods: dbtConnectionMethods,
    context: createContext,
    stores: [dbtRunStore],
    resources: [
      overview,
      projects,
      jobs,
      runs,
      runDetail,
      runLogs,
      runArtifacts,
      artifactDetail,
      artifacts,
      models,
      modelDetail,
      modelColumns,
      modelLineage,
      runGraph,
      sources,
      tests,
      dashboard,
      recentRuns,
      manifestOverview,
      semanticOverview,
      semanticModels,
      semanticMetrics,
      semanticSavedQueries,
      catalogRelations,
      freshnessRows,
      graphSummaryRows,
      osiOverview,
      runResultsOverview,
      runResultRows,
    ],
    actions: [triggerJob, cancelRun, execute, runBuild],
    pages: [
      overviewPage,
      projectsPage,
      jobsPage,
      runsPage,
      runDetailPage,
      artifactsPage,
      artifactDetailPage,
      modelsPage,
      modelDetailPage,
      sourcesPage,
      testsPage,
    ],
  });
}

export const dbtAdapter = createDbtAdapter();

export default dbtAdapter;
