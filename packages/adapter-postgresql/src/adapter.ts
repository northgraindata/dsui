import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
import { runQuery } from "./actions/run-query.js";
import { createPostgreSQLClient } from "./client.js";
import {
  createPostgreSQLContext,
  type PostgreSQLConfig,
  type PostgreSQLContext,
  postgresqlConnectionSchema,
} from "./context.js";
import { activityPage } from "./pages/activity.js";
import {
  databasesPage,
  relationColumnsPage,
  relationsPage,
  schemasPage,
} from "./pages/catalog.js";
import { overviewPage } from "./pages/overview.js";
import { queryPage } from "./pages/query.js";
import { activity } from "./resources/activity.js";
import {
  columns,
  constraints,
  databases,
  indexes,
  relations,
  schemas,
} from "./resources/catalog.js";
import { relationPreview } from "./resources/preview.js";
import { serverInfo } from "./resources/server.js";
import { activityFiltersStore } from "./stores/activity-filters.js";
import { queryEditorStore } from "./stores/query-editor.js";

export function createPostgreSQLAdapter() {
  return defineAdapter<PostgreSQLContext, PostgreSQLConfig>({
    metadata: {
      id: "postgresql",
      name: "PostgreSQL",
      version: "0.1.0",
      author: "DSUI",
      description: "Inspect PostgreSQL databases and run SQL queries.",
    },
    connectionMethods: {
      postgresql: {
        label: "PostgreSQL",
        description:
          "Connect to a PostgreSQL server using structured settings.",
        schema: postgresqlConnectionSchema,
      },
    },
    context: async (config) => {
      const client = createPostgreSQLClient(config);
      try {
        await client.serverInfo();
        return createPostgreSQLContext(client, config);
      } catch (error) {
        await client.dispose();
        throw error;
      }
    },
    disposeContext: (ctx) => ctx.client.dispose(),
    stores: [queryEditorStore, activityFiltersStore],
    resources: [
      serverInfo,
      databases,
      schemas,
      relations,
      columns,
      indexes,
      constraints,
      relationPreview,
      activity,
    ],
    actions: [runQuery],
    pages: [
      overviewPage,
      databasesPage,
      schemasPage,
      relationsPage,
      relationColumnsPage,
      queryPage,
      activityPage,
    ],
  });
}

export const postgresqlAdapter = createPostgreSQLAdapter();

export default postgresqlAdapter;
