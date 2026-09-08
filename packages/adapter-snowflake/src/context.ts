import { z } from "@northgraindata/dsui-adapter-sdk";

/**
 * Snowflake reference adapter context: runtime dependencies for one
 * configured instance. Holds the API client and logger only — never UI
 * state (selected warehouse, filters, editor content live in stores).
 */

export const snowflakeConnectionSchema = z.object({
  accountIdentifier: z.string().min(1),
  token: z.string().min(1),
  host: z.string().url().optional(),
  warehouse: z.string().optional(),
  database: z.string().optional(),
  schema: z.string().optional(),
  role: z.string().optional(),
});

export type SnowflakeConfig = z.output<typeof snowflakeConnectionSchema>;

export interface Warehouse {
  name: string;
  status: string;
  size: string;
}

export interface WarehouseDetails extends Warehouse {
  type: string;
  autoSuspend: string;
  autoResume: string;
  minClusters: string;
  maxClusters: string;
  owner: string;
  runningQueries: number;
  queuedQueries: number;
}

export interface DatabaseDetails {
  name: string;
  owner: string;
  created: string;
  retention: string;
  comment: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: string;
  comment: string;
}

export interface ViewDetails {
  database: string;
  schema: string;
  name: string;
  definition: string;
  columns: number;
}

export interface StageInfo {
  database: string;
  schema: string;
  name: string;
  url: string;
}

export interface StageFile {
  name: string;
  size: number;
  lastModified: string;
}

export interface StreamInfo {
  database: string;
  schema: string;
  name: string;
  source: string;
  mode: string;
  stale: string;
}

export interface RoutineInfo {
  database: string;
  schema: string;
  name: string;
  kind: "FUNCTION" | "PROCEDURE";
  language: string;
  signature: string;
  definition: string;
}

export interface TaskSummary {
  database: string;
  schema: string;
  name: string;
  status: string;
  schedule: string;
  warehouse: string;
}

export interface TaskDetails extends TaskSummary {
  definition: string;
  predecessors: string[];
  lastRun: string;
  nextRun: string;
}

export interface TaskRun {
  id: string;
  status: string;
  scheduled: string;
  completed: string;
}

export interface PipeInfo {
  database: string;
  schema: string;
  name: string;
  status: string;
}

export interface ComputePoolInfo {
  name: string;
  status: string;
  nodes: number;
}

export interface AccessRow {
  query: string;
  user: string;
  object: string;
  timestamp: string;
}

export interface AccountInfo {
  name: string;
  organization: string;
  region: string;
  edition: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
}

export interface UserInfo {
  name: string;
  status: string;
  defaultRole: string;
  defaultWarehouse: string;
}

export interface RoleInfo {
  name: string;
  owner: string;
}

export interface GrantInfo {
  privilege: string;
  grantedOn: string;
  name: string;
  grantee: string;
  grantOption: string;
}

export interface DynamicTableInfo {
  database: string;
  schema: string;
  name: string;
  status: string;
  lag: string;
  warehouse: string;
}

export interface CopyHistoryEntry {
  file: string;
  table: string;
  status: string;
  rows: number;
  errors: number;
  timestamp: string;
}

export interface CostRow {
  warehouse: string;
  credits: number;
  day: string;
}

export interface BudgetInfo {
  name: string;
  limit: number;
  spent: number;
}

export interface MonitorInfo {
  name: string;
  quota: number;
  used: number;
  status: string;
}

export interface QuerySummary {
  id: string;
  user: string;
  warehouse: string;
  status: string;
  text: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface SnowflakeClient {
  /** Abort in-flight client requests when the owning instance is disposed. */
  dispose?(): void;
  // Catalog
  listDatabases(): Promise<string[]>;
  getDatabase(database: string): Promise<DatabaseDetails>;
  listSchemas(database: string): Promise<string[]>;
  listTables(database: string, schema: string): Promise<string[]>;
  getTable(
    database: string,
    schema: string,
    table: string,
  ): Promise<Record<string, unknown>>;
  getTableDdl(database: string, schema: string, table: string): Promise<string>;
  getColumns(
    database: string,
    schema: string,
    table: string,
  ): Promise<ColumnInfo[]>;
  previewTable(
    database: string,
    schema: string,
    table: string,
  ): Promise<QueryResult>;
  listViews(database: string, schema: string): Promise<string[]>;
  getView(database: string, schema: string, view: string): Promise<ViewDetails>;
  listStages(database: string, schema: string): Promise<StageInfo[]>;
  listStageFiles(
    database: string,
    schema: string,
    stage: string,
  ): Promise<StageFile[]>;
  listStreams(database: string, schema: string): Promise<StreamInfo[]>;
  listSequences(database: string, schema: string): Promise<string[]>;
  listMaterializedViews(database: string, schema: string): Promise<string[]>;
  listFileFormats(database: string, schema: string): Promise<string[]>;
  listFunctions(database: string, schema: string): Promise<RoutineInfo[]>;
  listProcedures(database: string, schema: string): Promise<RoutineInfo[]>;
  executeProcedure(
    database: string,
    schema: string,
    name: string,
    args: string,
  ): Promise<QueryResult>;
  // Compute
  listWarehouses(): Promise<Warehouse[]>;
  getWarehouse(warehouse: string): Promise<WarehouseDetails>;
  createWarehouse(input: { name: string; size: string }): Promise<void>;
  dropWarehouse(warehouse: string): Promise<void>;
  suspendWarehouse(warehouse: string): Promise<void>;
  resumeWarehouse(warehouse: string): Promise<void>;
  resizeWarehouse(warehouse: string, size: string): Promise<void>;
  listDynamicTables(
    database: string,
    schema: string,
  ): Promise<DynamicTableInfo[]>;
  suspendDynamicTable(
    database: string,
    schema: string,
    name: string,
  ): Promise<void>;
  resumeDynamicTable(
    database: string,
    schema: string,
    name: string,
  ): Promise<void>;
  // Monitoring
  listQueries(filter: {
    warehouse: string | null;
    status: string | null;
    search: string;
  }): Promise<QuerySummary[]>;
  getQuery(queryId: string): Promise<QuerySummary | null>;
  cancelQuery(queryId: string): Promise<void>;
  getQueryResults(queryId: string): Promise<QueryResult | null>;
  listTasks(database: string, schema: string): Promise<TaskSummary[]>;
  getTask(
    database: string,
    schema: string,
    task: string,
  ): Promise<TaskDetails | null>;
  runTask(database: string, schema: string, task: string): Promise<void>;
  taskHistory(
    database: string,
    schema: string,
    task: string,
  ): Promise<TaskRun[]>;
  suspendTask(database: string, schema: string, task: string): Promise<void>;
  resumeTask(database: string, schema: string, task: string): Promise<void>;
  listLogs(filter: {
    search: string;
    level: string | null;
  }): Promise<LogEntry[]>;
  appendLog(entry: Omit<LogEntry, "timestamp">): Promise<void>;
  listPipes(database: string, schema: string): Promise<PipeInfo[]>;
  pausePipe(database: string, schema: string, pipe: string): Promise<void>;
  resumePipe(database: string, schema: string, pipe: string): Promise<void>;
  listComputePools(): Promise<ComputePoolInfo[]>;
  suspendComputePool(name: string): Promise<void>;
  resumeComputePool(name: string): Promise<void>;
  queryAccessHistory(): Promise<AccessRow[]>;
  getAccount(): Promise<AccountInfo>;
  // Governance
  listUsers(): Promise<UserInfo[]>;
  getUser(name: string): Promise<UserInfo | null>;
  createUser(input: { name: string; password: string }): Promise<void>;
  suspendUser(name: string): Promise<void>;
  resumeUser(name: string): Promise<void>;
  listRoles(): Promise<RoleInfo[]>;
  listGrants(): Promise<GrantInfo[]>;
  grantPrivilege(input: {
    privilege: string;
    objectType: string;
    objectName: string;
    to: string;
  }): Promise<void>;
  revokePrivilege(input: {
    privilege: string;
    objectType: string;
    objectName: string;
    from: string;
  }): Promise<void>;
  // Ingestion
  listCopyHistory(
    database: string,
    schema: string,
    table: string | null,
  ): Promise<CopyHistoryEntry[]>;
  // Cost
  warehouseSpend(days: number): Promise<CostRow[]>;
  listBudgets(): Promise<BudgetInfo[]>;
  listMonitors(): Promise<MonitorInfo[]>;
  suspendMonitor(name: string): Promise<void>;
  resumeMonitor(name: string): Promise<void>;
  // Ad-hoc SQL
  execute(
    sql: string,
    options: {
      warehouse: string | null;
      database: string | null;
      schema: string | null;
      role: string | null;
      signal?: AbortSignal;
    },
  ): Promise<QueryResult>;
}

export interface SnowflakeContext {
  client: SnowflakeClient;
  config: SnowflakeConfig;
  log(message: string, fields?: Record<string, unknown>): void;
}

export function createContext(
  client: SnowflakeClient,
  config: SnowflakeConfig,
): SnowflakeContext {
  return {
    client,
    config,
    log: (message, fields) => {
      void message;
      void fields;
    },
  };
}
