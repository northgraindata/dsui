import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
import { pauseDag, triggerDag, unpauseDag } from "./actions/dags.js";
import { clearTask, retryTask } from "./actions/tasks.js";
import { createAirflowClient } from "./client.js";
import {
  type AirflowClient,
  type AirflowConfig,
  type AirflowHttpConfig,
  airflow2ConnectionSchema,
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
  taskInstanceGraph,
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
      iconUrl: "https://airflow.apache.org/images/airflow-logo-dark.svg",
      description: "Browse and operate Apache Airflow DAGs, runs, and assets.",
    },
    connectionMethods: {
      airflow: {
        label: "Airflow 3",
        description:
          "Enter the Airflow deployment URL and a JWT access token from your auth manager's /auth/token endpoint.",
        schema: airflowConnectionSchema,
      },
      "airflow-2": {
        label: "Airflow 2.10",
        description:
          "Enter the Airflow deployment URL and Basic-auth username and password configured for the stable REST API.",
        schema: airflow2ConnectionSchema,
      },
    },
    context: (config: AirflowConfig) => {
      const clientConfig: AirflowHttpConfig =
        config.method === "airflow-2"
          ? {
              apiVersion: "v1",
              baseUrl: config.baseUrl,
              username: config.username,
              password: config.password,
            }
          : config;
      return createContext(createClient(clientConfig), config);
    },
    disposeContext: (ctx) => ctx.client.dispose(),
    resources: [
      dags,
      dagDetails,
      dagTasks,
      dagRuns,
      dagRunDetails,
      taskInstances,
      taskInstanceGraph,
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
