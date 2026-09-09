import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
import { pauseDag, triggerDag, unpauseDag } from "./actions/dags.js";
import { clearTask, retryTask } from "./actions/tasks.js";
import { createAirflowClient } from "./client.js";
import {
  type AirflowClient,
  type AirflowConfig,
  type AirflowHttpConfig,
  airflowConnectionSchema,
  createContext,
} from "./context.js";
import { assetDetailPage, assetListPage } from "./pages/assets.js";
import { dagDetailPage, dagListPage } from "./pages/dags.js";
import { dagRunDetailPage, taskInstanceDetailPage } from "./pages/runs.js";
import { assetDetails, assetEvents, assets } from "./resources/assets.js";
import { dagDetails, dags, dagTasks } from "./resources/dags.js";
import {
  dagRunDetails,
  dagRuns,
  taskInstanceDetails,
  taskInstances,
  taskLog,
} from "./resources/runs.js";

export function createAirflowAdapter(
  createClient: (
    config: AirflowHttpConfig,
  ) => AirflowClient = createAirflowClient,
) {
  return defineAdapter({
    metadata: {
      id: "airflow",
      name: "Airflow",
      version: "1.0.0",
      author: "DSUI",
      iconUrl: "/assets/logos/airflow.svg",
      description: "Browse and operate Apache Airflow DAGs, runs, and assets.",
    },
    connectionMethods: {
      airflow: {
        label: "Airflow 3",
        description:
          "Enter the Airflow deployment URL and a JWT access token from your auth manager's /auth/token endpoint.",
        schema: airflowConnectionSchema,
      },
    },
    context: (config: AirflowConfig) =>
      createContext(createClient(config), config),
    disposeContext: (ctx) => ctx.client.dispose(),
    resources: [
      dags,
      dagDetails,
      dagTasks,
      dagRuns,
      dagRunDetails,
      taskInstances,
      taskInstanceDetails,
      taskLog,
      assets,
      assetDetails,
      assetEvents,
    ],
    actions: [triggerDag, pauseDag, unpauseDag, retryTask, clearTask],
    pages: [
      dagListPage,
      dagDetailPage,
      dagRunDetailPage,
      taskInstanceDetailPage,
      assetListPage,
      assetDetailPage,
    ],
  });
}

export const airflowAdapter = createAirflowAdapter();

export default airflowAdapter;
