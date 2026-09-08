import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
import { resumeComputePool, suspendComputePool } from "./actions/compute.js";
import { resumeMonitor, suspendMonitor } from "./actions/cost.js";
import {
  createUser,
  grantPrivilege,
  resumeUser,
  revokePrivilege,
  suspendUser,
} from "./actions/governance.js";
import {
  executeProcedure,
  pausePipe,
  resumeDynamicTable,
  resumePipe,
  suspendDynamicTable,
} from "./actions/ingestion.js";
import { cancelQuery, runQuery } from "./actions/run-query.js";
import { resumeTask, runTask, suspendTask } from "./actions/tasks.js";
import {
  createWarehouse,
  dropWarehouse,
  resizeWarehouse,
  resumeWarehouse,
  suspendWarehouse,
} from "./actions/warehouses.js";
import {
  createContext,
  type SnowflakeClient,
  type SnowflakeConfig,
  type SnowflakeContext,
  snowflakeConnectionSchema,
} from "./context.js";
import { accessHistoryPage, accountPage } from "./pages/admin.js";
import { poolsPage } from "./pages/compute.js";
import { costPage } from "./pages/cost.js";
import {
  databasePage,
  databasesPage,
  schemaPage,
  tablePage,
  viewPage,
} from "./pages/databases.js";
import {
  grantsPage,
  rolesPage,
  userDetailPage,
  usersPage,
} from "./pages/governance.js";
import {
  copyHistoryPage,
  dynamicTablesPage,
  stageFilesPage,
  stagesPage,
  streamsPage,
} from "./pages/ingestion.js";
import { logsPage } from "./pages/logs.js";
import { pipesPage } from "./pages/pipes.js";
import { queryDetailPage, queryHistoryPage } from "./pages/queries.js";
import { queryEditorPage } from "./pages/query-editor.js";
import { routinesPage } from "./pages/routines.js";
import { taskDetailPage, taskListPage } from "./pages/tasks.js";
import { warehouseDetailPage, warehousesPage } from "./pages/warehouses.js";
import { accessHistory, accountDetails } from "./resources/admin.js";
import { computePools } from "./resources/compute.js";
import { budgets, monitors, warehouseSpend } from "./resources/cost.js";
import {
  databaseDetails,
  databases,
  fileFormats,
  materializedViews,
  schemas,
  sequences,
  tableColumns,
  tableDdl,
  tableDetails,
  tablePreview,
  tables,
  viewDetails,
  views,
} from "./resources/databases.js";
import { grants, roles, userDetails, users } from "./resources/governance.js";
import {
  copyHistory,
  dynamicTables,
  pipes,
  stageFiles,
  stages,
  streams,
} from "./resources/ingestion.js";
import { logs } from "./resources/logs.js";
import { queries, queryDetails, queryResults } from "./resources/queries.js";
import { functions, procedures } from "./resources/routines.js";
import { taskDetails, taskHistory, tasks } from "./resources/tasks.js";
import { warehouseDetails, warehouses } from "./resources/warehouses.js";
import { createSnowflakeClient } from "./sql-client.js";
import { logFiltersStore } from "./stores/log-filters.js";
import { queryEditorStore } from "./stores/query-editor.js";
import { queryFiltersStore } from "./stores/query-filters.js";
import { sessionStore } from "./stores/session.js";

/**
 * Snowflake adapter factory.
 *
 * Uses the same public SDK as community adapters — no privileged internals.
 * The default client talks to Snowflake over the SQL API transport; pass an
 * explicit factory for tests and demos that must not touch the network.
 *
 * @example
 * ```ts
 * // Production: contact Snowflake.
 * export default createSnowflakeAdapter();
 * // Tests and demos: in-memory client, fresh state per instance.
 * const testAdapter = createSnowflakeAdapter(() => createFakeSnowflakeClient());
 * ```
 */
export function createSnowflakeAdapter(
  createClient: (config: SnowflakeConfig) => SnowflakeClient = (config) =>
    createSnowflakeClient(config),
) {
  const adapter = defineAdapter({
    metadata: {
      id: "snowflake",
      name: "Snowflake",
      version: "1.0.0",
      author: "DSUI",
      description:
        "Browse Snowflake objects, warehouses, history, and run SQL.",
    },
    connectionSchema: snowflakeConnectionSchema,
    context: (config: SnowflakeConfig): SnowflakeContext =>
      createContext(createClient(config), config),
    disposeContext: (ctx) => ctx.client.dispose?.(),
    stores: [
      sessionStore,
      queryFiltersStore,
      queryEditorStore,
      logFiltersStore,
    ],
    resources: [
      databases,
      databaseDetails,
      schemas,
      tables,
      tableDetails,
      tableColumns,
      tablePreview,
      tableDdl,
      views,
      viewDetails,
      sequences,
      materializedViews,
      fileFormats,
      stages,
      stageFiles,
      streams,
      copyHistory,
      dynamicTables,
      pipes,
      functions,
      procedures,
      warehouses,
      warehouseDetails,
      computePools,
      queries,
      queryDetails,
      queryResults,
      tasks,
      taskDetails,
      taskHistory,
      logs,
      users,
      userDetails,
      roles,
      grants,
      warehouseSpend,
      budgets,
      monitors,
      accessHistory,
      accountDetails,
    ],
    actions: [
      runQuery,
      cancelQuery,
      suspendWarehouse,
      resumeWarehouse,
      resizeWarehouse,
      createWarehouse,
      dropWarehouse,
      suspendComputePool,
      resumeComputePool,
      runTask,
      suspendTask,
      resumeTask,
      suspendDynamicTable,
      resumeDynamicTable,
      executeProcedure,
      pausePipe,
      resumePipe,
      createUser,
      suspendUser,
      resumeUser,
      grantPrivilege,
      revokePrivilege,
      suspendMonitor,
      resumeMonitor,
    ],
    pages: [
      databasesPage,
      databasePage,
      schemaPage,
      tablePage,
      viewPage,
      stagesPage,
      stageFilesPage,
      streamsPage,
      copyHistoryPage,
      dynamicTablesPage,
      pipesPage,
      routinesPage,
      warehousesPage,
      warehouseDetailPage,
      poolsPage,
      queryHistoryPage,
      queryDetailPage,
      queryEditorPage,
      taskListPage,
      taskDetailPage,
      logsPage,
      usersPage,
      userDetailPage,
      rolesPage,
      grantsPage,
      costPage,
      accessHistoryPage,
      accountPage,
    ],
  });

  return adapter;
}

/** Default export talks to Snowflake; tests inject the fake explicitly. */
export const snowflakeAdapter = createSnowflakeAdapter();

export default snowflakeAdapter;
