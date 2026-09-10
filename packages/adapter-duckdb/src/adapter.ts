import { defineAdapter } from "@northgraindata/dsui-adapter-sdk";
import {
  createSecret,
  dropSecret,
  installExtension,
  loadExtension,
  resetSetting,
  restartExtension,
  setSetting,
} from "./actions/config.js";
import { cancelQuery, runQuery } from "./actions/run-query.js";
import {
  attachDatabase,
  createIndex,
  createSchema,
  createTable,
  createView,
  detachDatabase,
  dropIndex,
  dropSchema,
  dropTable,
  dropView,
  importData,
} from "./actions/schema.js";
import {
  createContext,
  type DuckDbClient,
  type DuckDbConfig,
  type DuckDbContext,
  duckdbConnectionMethods,
} from "./context.js";
import { createDuckDbClient } from "./duckdb-client.js";
import { activityPage } from "./pages/activity.js";
import { dataPage } from "./pages/data.js";
import { databasePage } from "./pages/database.js";
import { extensionPage, extensionsPage } from "./pages/extensions.js";
import { filesPage } from "./pages/files.js";
import { overviewPage } from "./pages/overview.js";
import { queryPage } from "./pages/query.js";
import { schemaPage } from "./pages/schema.js";
import { relationPage } from "./pages/table.js";
import {
  columnProfile,
  databaseCards,
  databaseDetails,
  databaseSize,
  databaseStats,
  databases,
  extensionCards,
  functions,
  indexes,
  macros,
  overview,
  recentQueries,
  recentTables,
  relations,
  schemas,
  sequences,
  storageMeter,
  tableColumns,
  tableDdl,
  tablePreview,
  tableRowCounts,
  tables,
  types,
  version,
  viewDdl,
  views,
} from "./resources/catalog.js";
import {
  extensionDetails,
  extensions,
  secrets,
  settings,
} from "./resources/config.js";
import {
  extensionCatalog,
  extensionProfileResource,
} from "./resources/extensions";
import { queryHistory } from "./resources/history.js";
import {
  activityFiltersStore,
  dataExplorerStore,
  fileBrowserStore,
  queryEditorStore,
  sessionStore,
  settingsFilterStore,
} from "./stores/index.js";

/**
 * DuckDB adapter factory.
 *
 * Uses the same public SDK as community adapters — no privileged internals.
 * The default client opens an `@duckdb/node-api` instance per connection;
 * pass an explicit factory for callers that must customize construction.
 */
export function createDuckDbAdapter(
  createClient: (config: DuckDbConfig) => DuckDbClient = (config) =>
    createDuckDbClient(config),
) {
  return defineAdapter({
    metadata: {
      id: "duckdb",
      name: "DuckDB",
      version: "0.1.0",
      author: "DSUI",
      description: "Browse DuckDB catalogs, run SQL, and manage extensions.",
      iconUrl:
        "https://pbs.twimg.com/profile_images/1274363897676521474/qgbqYYuV_400x400.jpg",
    },
    connectionMethods: duckdbConnectionMethods,
    context: (config: DuckDbConfig): DuckDbContext =>
      createContext(createClient(config), config),
    disposeContext: (ctx) => ctx.client.dispose(),
    stores: [
      sessionStore,
      queryEditorStore,
      dataExplorerStore,
      fileBrowserStore,
      activityFiltersStore,
      settingsFilterStore,
    ],
    resources: [
      version,
      overview,
      databases,
      databaseCards,
      databaseDetails,
      databaseSize,
      databaseStats,
      schemas,
      tables,
      tableRowCounts,
      recentTables,
      recentQueries,
      storageMeter,
      relations,
      tableColumns,
      tablePreview,
      tableDdl,
      viewDdl,
      columnProfile,
      views,
      sequences,
      indexes,
      macros,
      functions,
      types,
      extensions,
      extensionCards,
      extensionDetails,
      extensionCatalog,
      extensionProfileResource,
      settings,
      secrets,
      queryHistory,
    ],
    actions: [
      runQuery,
      cancelQuery,
      attachDatabase,
      detachDatabase,
      createSchema,
      dropSchema,
      createTable,
      dropTable,
      createView,
      dropView,
      createIndex,
      dropIndex,
      importData,
      installExtension,
      loadExtension,
      restartExtension,
      setSetting,
      resetSetting,
      createSecret,
      dropSecret,
    ],
    pages: [
      overviewPage,
      dataPage,
      databasePage,
      schemaPage,
      relationPage,
      queryPage,
      filesPage,
      extensionsPage,
      extensionPage,
      activityPage,
    ],
  });
}

export const duckdbAdapter = createDuckDbAdapter();

export default duckdbAdapter;
