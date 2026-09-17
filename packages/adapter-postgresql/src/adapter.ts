import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
import { cancelQuery } from "./actions/cancel-query.js";
import { runQuery } from "./actions/run-query.js";
import { createPostgreSQLClient } from "./client.js";
import {
  createPostgreSQLContext,
  type PostgreSQLConfig,
  type PostgreSQLContext,
  postgresqlConnectionSchema,
} from "./context.js";
import { activityPage } from "./pages/activity.js";
import { dataPage } from "./pages/data.js";
import { databasePage } from "./pages/database.js";
import { overviewPage } from "./pages/overview.js";
import { databaseQueryPage, queryPage } from "./pages/query.js";
import { relationPage } from "./pages/relation.js";
import { schemaPage } from "./pages/schema.js";
import { activity } from "./resources/activity.js";
import { capabilities } from "./resources/capabilities.js";
import {
  columns,
  constraints,
  databaseColumns,
  databaseConstraints,
  databaseIndexes,
  databaseRelations,
  databaseSchemas,
  databases,
  indexes,
  relations,
  schemas,
} from "./resources/catalog.js";
import {
  connectionUsage,
  overview,
  schemaTableCounts,
  schemaTableMeter,
} from "./resources/overview.js";
import {
  databaseRelationPreview,
  databaseRelationPreviewRows,
  relationPreview,
} from "./resources/preview.js";
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
      iconUrl: "https://www.postgresql.org/media/img/about/press/elephant.png",
    },
    connectionMethods: {
      postgresql: {
        label: "PostgreSQL",
        description:
          "Connect to a PostgreSQL server using structured settings. Database is the initial connection target; Database Scope controls whether all accessible databases or only that database are shown.",
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
    disposeContext: (ctx) => ctx.dispose(),
    stores: [queryEditorStore, activityFiltersStore],
    resources: [
      serverInfo,
      databases,
      schemas,
      databaseSchemas,
      relations,
      databaseRelations,
      columns,
      databaseColumns,
      indexes,
      databaseIndexes,
      constraints,
      databaseConstraints,
      relationPreview,
      databaseRelationPreview,
      databaseRelationPreviewRows,
      activity,
      capabilities,
      overview,
      schemaTableCounts,
      schemaTableMeter,
      connectionUsage,
    ],
    actions: [runQuery, cancelQuery],
    pages: [
      overviewPage,
      dataPage,
      databasePage,
      schemaPage,
      relationPage,
      queryPage,
      databaseQueryPage,
      activityPage,
    ],
  });
}

export const postgresqlAdapter = createPostgreSQLAdapter();

export default postgresqlAdapter;
