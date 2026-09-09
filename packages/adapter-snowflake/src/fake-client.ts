import type {
  AccessRow,
  AccountInfo,
  ComputePoolInfo,
  GrantInfo,
  LogEntry,
  PipeInfo,
  QueryResult,
  QuerySummary,
  SnowflakeClient,
  StageFile,
  StageInfo,
  TaskDetails,
  TaskRun,
  UserInfo,
  Warehouse,
  WarehouseDetails,
} from "./context.js";

/**
 * In-memory Snowflake stand-in used by tests and local development.
 * Each call creates independent state, mirroring per-instance isolation.
 */
export function createFakeSnowflakeClient(
  seed?: Partial<FakeSeed>,
): SnowflakeClient {
  const warehouses: Warehouse[] = (
    seed?.warehouses ?? [
      { name: "ETL_WH", status: "RUNNING", size: "MEDIUM" },
      { name: "ANALYTICS_WH", status: "SUSPENDED", size: "LARGE" },
    ]
  ).map((w) => ({ ...w }));
  const queries: QuerySummary[] = (
    seed?.queries ?? [
      {
        id: "q1",
        user: "analyst",
        warehouse: "ETL_WH",
        status: "SUCCESS",
        text: "SELECT 1",
      },
      {
        id: "q2",
        user: "loader",
        warehouse: "ETL_WH",
        status: "FAILED",
        text: "SELECT * FROM missing",
      },
    ]
  ).map((q) => ({ ...q }));
  const results = new Map<string, QueryResult>([
    ["q1", { columns: ["one"], rows: [{ one: 1 }] }],
  ]);
  const tasks: TaskDetails[] = (
    seed?.tasks ?? [
      {
        database: "ANALYTICS",
        schema: "PUBLIC",
        name: "LOAD_EVENTS",
        status: "STARTED",
        schedule: "5 MINUTE",
        warehouse: "ETL_WH",
        definition: "COPY INTO events FROM @landing/events/",
        predecessors: [],
        lastRun: "2026-09-07T10:55:00Z",
        nextRun: "2026-09-07T11:00:00Z",
      },
      {
        database: "ANALYTICS",
        schema: "PUBLIC",
        name: "BUILD_MARTS",
        status: "SUSPENDED",
        schedule: "AFTER LOAD_EVENTS",
        warehouse: "ETL_WH",
        definition: "CREATE OR REPLACE DYNAMIC TABLE marts AS SELECT ...",
        predecessors: ["LOAD_EVENTS"],
        lastRun: "2026-09-07T10:50:00Z",
        nextRun: "",
      },
    ]
  ).map((t) => ({ ...t, predecessors: [...t.predecessors] }));
  const logs: LogEntry[] = (
    seed?.logs ?? [
      {
        timestamp: "2026-09-07T10:59:00Z",
        level: "INFO",
        source: "warehouse",
        message: "ETL_WH resumed",
      },
    ]
  ).map((l) => ({ ...l }));
  const users: UserInfo[] = (
    seed?.users ?? [
      {
        name: "ANALYST",
        status: "ACTIVE",
        defaultRole: "ANALYST",
        defaultWarehouse: "ANALYTICS_WH",
      },
    ]
  ).map((u) => ({ ...u }));
  const grants: GrantInfo[] = (
    seed?.grants ?? [
      {
        privilege: "USAGE",
        grantedOn: "WAREHOUSE",
        name: "ETL_WH",
        grantee: "LOADER",
        grantOption: "false",
      },
    ]
  ).map((g) => ({ ...g }));
  let executions = 0;

  const findWarehouse = (warehouse: string): Warehouse => {
    const found = warehouses.find((w) => w.name === warehouse);
    if (!found) throw new Error(`Unknown warehouse: ${warehouse}`);
    return found;
  };

  return {
    async listDatabases() {
      return ["ANALYTICS", "RAW"];
    },
    async getDatabase(database) {
      return {
        name: database,
        owner: "SYSADMIN",
        created: "2026-01-15T09:00:00Z",
        retention: "1 day",
        comment: `${database} database`,
      };
    },
    async listSchemas(database) {
      return database === "ANALYTICS" ? ["PUBLIC", "MARTS"] : ["PUBLIC"];
    },
    async listTables(database, schema) {
      void database;
      void schema;
      return ["EVENTS", "USERS"];
    },
    async getTable(database, schema, table) {
      return { database, schema, table, columns: 4 };
    },
    async getTableDdl(database, schema, table) {
      return `CREATE TABLE ${database}.${schema}.${table} (ID NUMBER, NAME VARCHAR);`;
    },
    async getColumns(database, schema, table) {
      void database;
      void schema;
      void table;
      return [
        { name: "ID", type: "NUMBER", nullable: "false", comment: "" },
        { name: "NAME", type: "VARCHAR", nullable: "true", comment: "" },
      ];
    },
    async previewTable() {
      return {
        columns: ["id", "name"],
        rows: [{ id: 1, name: "alpha" }],
      };
    },
    async listViews(database, schema) {
      void database;
      void schema;
      return ["EVENT_SUMMARY"];
    },
    async getView(database, schema, view) {
      return {
        database,
        schema,
        name: view,
        definition: `CREATE VIEW ${view} AS SELECT ...`,
        columns: 3,
      };
    },
    async listStages(database, schema) {
      const stage: StageInfo = {
        database,
        schema,
        name: "LANDING",
        url: "s3://landing/",
      };
      return [stage];
    },
    async listStageFiles(database, schema, stage) {
      void database;
      void schema;
      const file: StageFile = {
        name: `${stage}/events/2026-09-07.json`,
        size: 1024,
        lastModified: "2026-09-07T10:00:00Z",
      };
      return [file];
    },
    async listStreams(database, schema) {
      return [
        {
          database,
          schema,
          name: "EVENTS_STREAM",
          source: "EVENTS",
          mode: "APPEND_ONLY",
          stale: "false",
        },
      ];
    },
    async listSequences(database, schema) {
      void database;
      void schema;
      return ["EVENT_SEQ"];
    },
    async listMaterializedViews(database, schema) {
      void database;
      void schema;
      return ["EVENT_DAILY"];
    },
    async listFileFormats(database, schema) {
      void database;
      void schema;
      return ["JSON_FORMAT"];
    },
    async listFunctions(database, schema) {
      return [
        {
          database,
          schema,
          name: "NORMALIZE",
          kind: "FUNCTION",
          language: "SQL",
          signature: "(VARCHAR)",
          definition: "RETURN ...",
        },
      ];
    },
    async listProcedures(database, schema) {
      return [
        {
          database,
          schema,
          name: "REBUILD_MART",
          kind: "PROCEDURE",
          language: "SQL",
          signature: "()",
          definition: "BEGIN ... END",
        },
      ];
    },
    async executeProcedure(database, schema, name) {
      void database;
      void schema;
      return { columns: ["status"], rows: [{ status: `${name} completed` }] };
    },
    async listWarehouses() {
      return warehouses.map((w) => ({ ...w }));
    },
    async getWarehouse(warehouse) {
      const found = findWarehouse(warehouse);
      const details: WarehouseDetails = {
        ...found,
        type: "STANDARD",
        autoSuspend: "5 minutes",
        autoResume: "true",
        minClusters: "1",
        maxClusters: "2",
        owner: "SYSADMIN",
        runningQueries: 1,
        queuedQueries: 0,
      };
      return details;
    },
    async createWarehouse(input) {
      if (warehouses.some((w) => w.name === input.name))
        throw new Error(`Warehouse already exists: ${input.name}`);
      warehouses.push({
        name: input.name,
        status: "SUSPENDED",
        size: input.size,
      });
    },
    async dropWarehouse(warehouse) {
      const index = warehouses.findIndex((w) => w.name === warehouse);
      if (index < 0) throw new Error(`Unknown warehouse: ${warehouse}`);
      warehouses.splice(index, 1);
    },
    async suspendWarehouse(warehouse) {
      findWarehouse(warehouse).status = "SUSPENDED";
    },
    async resumeWarehouse(warehouse) {
      findWarehouse(warehouse).status = "RUNNING";
    },
    async resizeWarehouse(warehouse, size) {
      findWarehouse(warehouse).size = size;
    },
    async listDynamicTables(database, schema) {
      return [
        {
          database,
          schema,
          name: "MARTS",
          status: "ACTIVE",
          lag: "5 minutes",
          warehouse: "ETL_WH",
        },
      ];
    },
    async suspendDynamicTable() {
      // Fake tracks a single dynamic table as ACTIVE; suspension is a no-op
      // placeholder proving the action/invalidation wiring.
    },
    async resumeDynamicTable() {
      // See suspendDynamicTable.
    },
    async listQueries(filter) {
      return queries.filter(
        (q) =>
          (!filter.warehouse || q.warehouse === filter.warehouse) &&
          (!filter.status || q.status === filter.status) &&
          (!filter.search || q.text.includes(filter.search)),
      );
    },
    async getQuery(queryId) {
      return queries.find((q) => q.id === queryId) ?? null;
    },
    async cancelQuery(queryId) {
      const found = queries.find((q) => q.id === queryId);
      if (!found) throw new Error(`Unknown query: ${queryId}`);
      found.status = "CANCELLED";
    },
    async getQueryResults(queryId) {
      return results.get(queryId) ?? null;
    },
    async listTasks(database, schema) {
      return tasks
        .filter((t) => t.database === database && t.schema === schema)
        .map((t) => ({
          database: t.database,
          schema: t.schema,
          name: t.name,
          status: t.status,
          schedule: t.schedule,
          warehouse: t.warehouse,
        }));
    },
    async getTask(database, schema, task) {
      return (
        tasks.find(
          (t) =>
            t.database === database && t.schema === schema && t.name === task,
        ) ?? null
      );
    },
    async runTask(database, schema, task) {
      const found = tasks.find(
        (t) =>
          t.database === database && t.schema === schema && t.name === task,
      );
      if (!found) throw new Error(`Unknown task: ${task}`);
      found.lastRun = new Date().toISOString();
    },
    async taskHistory(database, schema, task) {
      void database;
      void schema;
      const run: TaskRun = {
        id: `${task}-run-1`,
        status: "SUCCEEDED",
        scheduled: "2026-09-07T10:55:00Z",
        completed: "2026-09-07T10:56:00Z",
      };
      return [run];
    },
    async suspendTask(database, schema, task) {
      const found = tasks.find(
        (t) =>
          t.database === database && t.schema === schema && t.name === task,
      );
      if (!found) throw new Error(`Unknown task: ${task}`);
      found.status = "SUSPENDED";
    },
    async resumeTask(database, schema, task) {
      const found = tasks.find(
        (t) =>
          t.database === database && t.schema === schema && t.name === task,
      );
      if (!found) throw new Error(`Unknown task: ${task}`);
      found.status = "STARTED";
    },
    async listLogs(filter) {
      return logs.filter(
        (l) =>
          (!filter.level || l.level === filter.level) &&
          (!filter.search || l.message.includes(filter.search)),
      );
    },
    async appendLog(entry) {
      logs.push({ ...entry, timestamp: new Date().toISOString() });
    },
    async listPipes(database, schema) {
      const pipe: PipeInfo = {
        database,
        schema,
        name: "EVENTS_PIPE",
        status: "RUNNING",
      };
      return [pipe];
    },
    async pausePipe() {
      // See suspendDynamicTable: proves action/invalidation wiring.
    },
    async resumePipe() {
      // See pausePipe.
    },
    async listComputePools() {
      const pool: ComputePoolInfo = {
        name: "ML_POOL",
        status: "ACTIVE",
        nodes: 1,
      };
      return [pool];
    },
    async suspendComputePool() {
      // See suspendDynamicTable: proves action/invalidation wiring.
    },
    async resumeComputePool() {
      // See suspendComputePool.
    },
    async queryAccessHistory() {
      const row: AccessRow = {
        query: "q1",
        user: "analyst",
        object: "ANALYTICS.PUBLIC.EVENTS",
        timestamp: "2026-09-07T10:59:00Z",
      };
      return [row];
    },
    async getAccount() {
      const account: AccountInfo = {
        name: "ORG-ACCOUNT",
        organization: "ORG",
        region: "AWS_EU_CENTRAL_1",
        edition: "ENTERPRISE",
      };
      return account;
    },
    async listUsers() {
      return users.map((u) => ({ ...u }));
    },
    async getUser(name) {
      return users.find((u) => u.name === name) ?? null;
    },
    async createUser(input) {
      if (users.some((u) => u.name === input.name))
        throw new Error(`User already exists: ${input.name}`);
      void input.password;
      users.push({
        name: input.name,
        status: "ACTIVE",
        defaultRole: "PUBLIC",
        defaultWarehouse: "",
      });
    },
    async suspendUser(name) {
      const found = users.find((u) => u.name === name);
      if (!found) throw new Error(`Unknown user: ${name}`);
      found.status = "SUSPENDED";
    },
    async resumeUser(name) {
      const found = users.find((u) => u.name === name);
      if (!found) throw new Error(`Unknown user: ${name}`);
      found.status = "ACTIVE";
    },
    async listRoles() {
      return [
        { name: "SYSADMIN", owner: "" },
        { name: "ANALYST", owner: "SYSADMIN" },
      ];
    },
    async listGrants() {
      return grants.map((g) => ({ ...g }));
    },
    async grantPrivilege(input) {
      grants.push({
        privilege: input.privilege,
        grantedOn: input.objectType,
        name: input.objectName,
        grantee: input.to,
        grantOption: "false",
      });
    },
    async revokePrivilege(input) {
      const index = grants.findIndex(
        (g) =>
          g.privilege === input.privilege &&
          g.name === input.objectName &&
          g.grantee === input.from,
      );
      if (index < 0) throw new Error("Grant not found");
      grants.splice(index, 1);
    },
    async listCopyHistory(database, schema, table) {
      const entry = {
        file: "events/2026-09-07.json",
        table: `${database}.${schema}.${table ?? "EVENTS"}`,
        status: "LOADED",
        rows: 1000,
        errors: 0,
        timestamp: "2026-09-07T10:00:00Z",
      };
      return [entry];
    },
    async warehouseSpend() {
      return [{ warehouse: "ETL_WH", credits: 12.5, day: "2026-09-07" }];
    },
    async listBudgets() {
      return [{ name: "ANALYTICS_BUDGET", limit: 1000, spent: 320 }];
    },
    async listMonitors() {
      return [{ name: "ETL_MONITOR", quota: 500, used: 120, status: "ACTIVE" }];
    },
    async suspendMonitor() {
      // Fake tracks a single monitor; suspension proves action wiring.
    },
    async resumeMonitor() {
      // See suspendMonitor.
    },
    async execute(sql) {
      executions++;
      const id = `q${executions + 100}`;
      const result: QueryResult = {
        columns: ["result"],
        rows: [{ result: "ok" }],
      };
      results.set(id, result);
      queries.unshift({
        id,
        user: "editor",
        warehouse: "ETL_WH",
        status: "SUCCESS",
        text: sql,
      });
      return result;
    },
  };
}

export interface FakeSeed {
  warehouses?: Warehouse[];
  queries?: QuerySummary[];
  tasks?: TaskDetails[];
  logs?: LogEntry[];
  users?: UserInfo[];
  grants?: GrantInfo[];
}
