import { z } from "@northgraindata/dsui-adapter-sdk";
import type {
  QueryResult,
  SnowflakeClient,
  SnowflakeConfig,
  WarehouseDetails,
} from "./context.js";
import { createSqlTransport, type TransportLimits } from "./sql-transport.js";
import { grantSql, procedureArguments, qualifiedName } from "./sql-values.js";

/** Server-side Snowflake operations over the bounded SQL API transport. */
export function createSnowflakeClient(
  config: SnowflakeConfig,
  fetchFn: typeof fetch = fetch,
  limits: Partial<TransportLimits> = {},
): SnowflakeClient {
  const { statement, dispose } = createSqlTransport(config, fetchFn, limits);
  const names = (result: QueryResult): string[] =>
    result.rows.map((row) => cell(row, "name"));

  const cell = (row: Record<string, unknown>, ...names: string[]): string => {
    for (const name of names) {
      const value =
        row[name] ?? row[name.toLowerCase()] ?? row[name.toUpperCase()];
      if (value !== undefined && value !== null) return String(value);
    }
    return "";
  };

  // SQL literals are needed for SHOW/DDL positions that do not accept bindings.
  const literal = (value: string): string =>
    `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
  const ident = (value: string): string => `"${value.replace(/"/g, '""')}"`;

  return {
    dispose,
    async listDatabases() {
      return names(await statement("SHOW DATABASES"));
    },
    async getDatabase(database) {
      const result = await statement(
        `SELECT database_name, database_owner, created, retention_time, comment FROM SNOWFLAKE.ACCOUNT_USAGE.DATABASES WHERE database_name = ? AND deleted IS NULL LIMIT 1`,
        [database],
      );
      const row = result.rows[0] ?? {};
      return {
        name: database,
        owner: cell(row, "database_owner"),
        created: cell(row, "created"),
        retention: cell(row, "retention_time"),
        comment: cell(row, "comment"),
      };
    },
    async listSchemas(database) {
      return names(
        await statement(`SHOW SCHEMAS IN DATABASE ${ident(database)}`),
      );
    },
    async listTables(database, schema) {
      return names(
        await statement(
          `SHOW TABLES IN SCHEMA ${ident(database)}.${ident(schema)}`,
        ),
      );
    },
    async getTable(database, schema, table) {
      const result = await statement(
        `DESCRIBE TABLE ${ident(database)}.${ident(schema)}.${ident(table)}`,
      );
      return {
        database,
        schema,
        table,
        columns: result.rows.length,
      };
    },
    async getTableDdl(database, schema, table) {
      const result = await statement("SELECT get_ddl('table', ?) AS ddl", [
        qualifiedName(database, schema, table),
      ]);
      return cell(result.rows[0] ?? {}, "ddl");
    },
    async getColumns(database, schema, table) {
      const result = await statement(
        `DESCRIBE TABLE ${ident(database)}.${ident(schema)}.${ident(table)}`,
      );
      return result.rows.map((row) => ({
        name: cell(row, "name"),
        type: cell(row, "type"),
        nullable: cell(row, "null?"),
        comment: cell(row, "comment"),
      }));
    },
    async previewTable(database, schema, table) {
      return statement(
        `SELECT * FROM ${ident(database)}.${ident(schema)}.${ident(table)} LIMIT 100`,
      );
    },
    async listViews(database, schema) {
      return names(
        await statement(
          `SHOW VIEWS IN SCHEMA ${ident(database)}.${ident(schema)}`,
        ),
      );
    },
    async getView(database, schema, view) {
      const result = await statement("SELECT get_ddl('view', ?) AS ddl", [
        qualifiedName(database, schema, view),
      ]);
      return {
        database,
        schema,
        name: view,
        definition: cell(result.rows[0] ?? {}, "ddl"),
        columns: 0,
      };
    },
    async listStages(database, schema) {
      const result = await statement(
        `SHOW STAGES IN SCHEMA ${ident(database)}.${ident(schema)}`,
      );
      return result.rows.map((row) => ({
        database,
        schema,
        name: cell(row, "name"),
        url: cell(row, "url"),
      }));
    },
    async listStageFiles(database, schema, stage) {
      const result = await statement(
        `LIST @${ident(database)}.${ident(schema)}.${ident(stage)}`,
      );
      return result.rows.map((row) => ({
        name: cell(row, "name"),
        size: Number(cell(row, "size") || 0),
        lastModified: cell(row, "last_modified"),
      }));
    },
    async listStreams(database, schema) {
      const result = await statement(
        `SHOW STREAMS IN SCHEMA ${ident(database)}.${ident(schema)}`,
      );
      return result.rows.map((row) => ({
        database,
        schema,
        name: cell(row, "name"),
        source: cell(row, "source_name", "table_name"),
        mode: cell(row, "mode"),
        stale: cell(row, "stale"),
      }));
    },
    async listSequences(database, schema) {
      return names(
        await statement(
          `SHOW SEQUENCES IN SCHEMA ${ident(database)}.${ident(schema)}`,
        ),
      );
    },
    async listMaterializedViews(database, schema) {
      return names(
        await statement(
          `SHOW MATERIALIZED VIEWS IN SCHEMA ${ident(database)}.${ident(schema)}`,
        ),
      );
    },
    async listFileFormats(database, schema) {
      return names(
        await statement(
          `SHOW FILE FORMATS IN SCHEMA ${ident(database)}.${ident(schema)}`,
        ),
      );
    },
    async listFunctions(database, schema) {
      const result = await statement(
        `SHOW USER FUNCTIONS IN SCHEMA ${ident(database)}.${ident(schema)}`,
      );
      return result.rows.map((row) => ({
        database,
        schema,
        name: cell(row, "name"),
        kind: "FUNCTION" as const,
        language: cell(row, "language"),
        signature: cell(row, "signature", "arguments"),
        definition: cell(row, "description"),
      }));
    },
    async listProcedures(database, schema) {
      const result = await statement(
        `SHOW PROCEDURES IN SCHEMA ${ident(database)}.${ident(schema)}`,
      );
      return result.rows.map((row) => ({
        database,
        schema,
        name: cell(row, "name"),
        kind: "PROCEDURE" as const,
        language: cell(row, "language"),
        signature: cell(row, "signature", "arguments"),
        definition: cell(row, "description"),
      }));
    },
    async executeProcedure(database, schema, name, args) {
      return statement(
        `CALL ${ident(database)}.${ident(schema)}.${ident(name)}(${procedureArguments(
          args,
        )
          .map(() => "?")
          .join(", ")})`,
        procedureArguments(args),
      );
    },
    async listWarehouses() {
      const result = await statement("SHOW WAREHOUSES");
      return result.rows.map((row) => ({
        name: cell(row, "name"),
        status: cell(row, "state", "status"),
        size: cell(row, "size"),
      }));
    },
    async getWarehouse(warehouse) {
      const result = await statement(
        `SHOW WAREHOUSES LIKE ${literal(warehouse)}`,
      );
      const row =
        result.rows.find((row) => cell(row, "name") === warehouse) ?? {};
      const details: WarehouseDetails = {
        name: warehouse,
        status: cell(row, "state", "status"),
        size: cell(row, "size"),
        type: cell(row, "type"),
        autoSuspend: cell(row, "auto_suspend"),
        autoResume: cell(row, "auto_resume"),
        minClusters: cell(row, "min_cluster_count"),
        maxClusters: cell(row, "max_cluster_count"),
        owner: cell(row, "owner"),
        runningQueries: Number(cell(row, "running") || 0),
        queuedQueries: Number(cell(row, "queued") || 0),
      };
      return details;
    },
    async createWarehouse(input) {
      await statement(
        `CREATE WAREHOUSE ${ident(input.name)} WITH WAREHOUSE_SIZE = ${literal(input.size)} INITIALLY_SUSPENDED = TRUE`,
      );
    },
    async dropWarehouse(warehouse) {
      await statement(`DROP WAREHOUSE ${ident(warehouse)}`);
    },
    async suspendWarehouse(warehouse) {
      await statement(`ALTER WAREHOUSE ${ident(warehouse)} SUSPEND`);
    },
    async resumeWarehouse(warehouse) {
      await statement(`ALTER WAREHOUSE ${ident(warehouse)} RESUME`);
    },
    async resizeWarehouse(warehouse, size) {
      await statement(
        `ALTER WAREHOUSE ${ident(warehouse)} SET WAREHOUSE_SIZE = ${literal(size)}`,
      );
    },
    async listDynamicTables(database, schema) {
      const result = await statement(
        `SHOW DYNAMIC TABLES IN SCHEMA ${ident(database)}.${ident(schema)}`,
      );
      return result.rows.map((row) => ({
        database,
        schema,
        name: cell(row, "name"),
        status: cell(row, "scheduling_state", "status"),
        lag: cell(row, "target_lag", "lag"),
        warehouse: cell(row, "warehouse"),
      }));
    },
    async suspendDynamicTable(database, schema, name) {
      await statement(
        `ALTER DYNAMIC TABLE ${ident(database)}.${ident(schema)}.${ident(name)} SUSPEND`,
      );
    },
    async resumeDynamicTable(database, schema, name) {
      await statement(
        `ALTER DYNAMIC TABLE ${ident(database)}.${ident(schema)}.${ident(name)} RESUME`,
      );
    },
    async listQueries(filter) {
      const clauses = [
        "END_TIME_RANGE_START=>DATEADD('hour',-24,CURRENT_TIMESTAMP())",
        "RESULT_LIMIT=>500",
      ];
      if (filter.warehouse) clauses.push("WAREHOUSE_NAME=>?");
      const result = await statement(
        `SELECT query_id, user_name, warehouse_name, execution_status, query_text FROM TABLE(INFORMATION_SCHEMA.${filter.warehouse ? "QUERY_HISTORY_BY_WAREHOUSE" : "QUERY_HISTORY"}(${clauses.join(",")})) ORDER BY start_time DESC`,
        filter.warehouse ? [filter.warehouse] : [],
      );
      return result.rows
        .map((row) => ({
          id: String(row.QUERY_ID ?? row.query_id ?? ""),
          user: cell(row, "user_name"),
          warehouse: cell(row, "warehouse_name"),
          status: cell(row, "execution_status"),
          text: String(row.QUERY_TEXT ?? row.query_text ?? ""),
        }))
        .filter(
          (q) =>
            (!filter.status || q.status === filter.status) &&
            (!filter.search || q.text.includes(filter.search)),
        );
    },
    async getQuery(queryId) {
      const queries = await this.listQueries({
        warehouse: null,
        status: null,
        search: "",
      });
      return queries.find((q) => q.id === queryId) ?? null;
    },
    async cancelQuery(queryId) {
      await statement("SELECT SYSTEM$CANCEL_QUERY(?)", [queryId]);
    },
    async getQueryResults(queryId) {
      return statement("SELECT * FROM TABLE(RESULT_SCAN(?))", [queryId]);
    },
    async listTasks(database, schema) {
      const result = await statement(
        `SHOW TASKS IN SCHEMA ${ident(database)}.${ident(schema)}`,
      );
      return result.rows.map((row) => ({
        database,
        schema,
        name: cell(row, "name"),
        status: cell(row, "state", "status"),
        schedule: cell(row, "schedule"),
        warehouse: cell(row, "warehouse"),
      }));
    },
    async getTask(database, schema, task) {
      const result = await statement(
        `SHOW TASKS LIKE ${literal(task)} IN SCHEMA ${ident(database)}.${ident(schema)}`,
      );
      const row = result.rows.find((row) => cell(row, "name") === task);
      if (!row) return null;
      const definition = await statement("SELECT get_ddl('task', ?) AS ddl", [
        qualifiedName(database, schema, task),
      ]);
      return {
        database,
        schema,
        name: task,
        status: cell(row, "state", "status"),
        schedule: cell(row, "schedule"),
        warehouse: cell(row, "warehouse"),
        definition: cell(definition.rows[0] ?? {}, "ddl"),
        predecessors: cell(row, "predecessors")
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        lastRun: cell(row, "last_scheduled_time"),
        nextRun: cell(row, "next_scheduled_time"),
      };
    },
    async runTask(database, schema, task) {
      await statement(
        `EXECUTE TASK ${ident(database)}.${ident(schema)}.${ident(task)}`,
      );
    },
    async taskHistory(database, schema, task) {
      const result = await statement(
        `SELECT query_id, state, scheduled_time, completed_time FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY(SCHEDULED_TIME_RANGE_START=>DATEADD('day',-1,CURRENT_TIMESTAMP()), TASK_NAME=>?)) ORDER BY scheduled_time DESC LIMIT 100`,
        [qualifiedName(database, schema, task)],
      );
      return result.rows.map((row) => ({
        id: cell(row, "query_id"),
        status: cell(row, "state"),
        scheduled: cell(row, "scheduled_time"),
        completed: cell(row, "completed_time"),
      }));
    },
    async suspendTask(database, schema, task) {
      await statement(
        `ALTER TASK ${ident(database)}.${ident(schema)}.${ident(task)} SUSPEND`,
      );
    },
    async resumeTask(database, schema, task) {
      await statement(
        `ALTER TASK ${ident(database)}.${ident(schema)}.${ident(task)} RESUME`,
      );
    },
    async listLogs(filter) {
      const result = await statement(
        `SELECT query_id, user_name, start_time, execution_status, query_text FROM TABLE(INFORMATION_SCHEMA.QUERY_HISTORY(END_TIME_RANGE_START=>DATEADD('hour',-1,CURRENT_TIMESTAMP()), RESULT_LIMIT=>200)) ORDER BY start_time DESC`,
      );
      return result.rows
        .map((row) => ({
          timestamp: cell(row, "start_time"),
          level: cell(row, "execution_status") === "SUCCESS" ? "INFO" : "ERROR",
          source: `query:${cell(row, "query_id")}`,
          message:
            `${cell(row, "user_name")}: ${cell(row, "query_text")}`.slice(
              0,
              500,
            ),
        }))
        .filter(
          (l) =>
            (!filter.level || l.level === filter.level) &&
            (!filter.search || l.message.includes(filter.search)),
        );
    },
    async appendLog() {
      throw new Error(
        "Appending to the log buffer requires the in-memory client; the SQL API client is read-only for logs",
      );
    },
    async listPipes(database, schema) {
      const result = await statement(
        `SHOW PIPES IN SCHEMA ${ident(database)}.${ident(schema)}`,
      );
      return result.rows.map((row) => ({
        database,
        schema,
        name: cell(row, "name"),
        status: cell(row, "status"),
      }));
    },
    async pausePipe(database, schema, pipe) {
      await statement(
        `ALTER PIPE ${ident(database)}.${ident(schema)}.${ident(pipe)} SET PIPE_EXECUTION_PAUSED = TRUE`,
      );
    },
    async resumePipe(database, schema, pipe) {
      await statement(
        `ALTER PIPE ${ident(database)}.${ident(schema)}.${ident(pipe)} SET PIPE_EXECUTION_PAUSED = FALSE`,
      );
    },
    async listComputePools() {
      const result = await statement("SHOW COMPUTE POOLS");
      return result.rows.map((row) => ({
        name: cell(row, "name"),
        status: cell(row, "state", "status"),
        nodes: Number(cell(row, "nodes", "num_nodes") || 0),
      }));
    },
    async suspendComputePool(name) {
      await statement(`ALTER COMPUTE POOL ${ident(name)} SUSPEND`);
    },
    async resumeComputePool(name) {
      await statement(`ALTER COMPUTE POOL ${ident(name)} RESUME`);
    },
    async queryAccessHistory() {
      const result = await statement(
        `SELECT query_id, user_name, base_objects_accessed, start_time FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY WHERE start_time >= DATEADD('day',-1,CURRENT_TIMESTAMP()) ORDER BY start_time DESC LIMIT 200`,
      );
      return result.rows.map((row) => ({
        query: cell(row, "query_id"),
        user: cell(row, "user_name"),
        object: cell(row, "base_objects_accessed").slice(0, 300),
        timestamp: cell(row, "start_time"),
      }));
    },
    async getAccount() {
      const result = await statement(
        "SELECT CURRENT_ACCOUNT() AS account, CURRENT_ORGANIZATION_NAME() AS organization, CURRENT_REGION() AS region",
      );
      const row = result.rows[0] ?? {};
      return {
        name: cell(row, "account"),
        organization: cell(row, "organization"),
        region: cell(row, "region"),
        edition: "",
      };
    },
    async listUsers() {
      const result = await statement("SHOW USERS");
      return result.rows.map((row) => ({
        name: cell(row, "name"),
        status:
          cell(row, "status", "disabled") === "off"
            ? "ACTIVE"
            : cell(row, "status"),
        defaultRole: cell(row, "default_role"),
        defaultWarehouse: cell(row, "default_warehouse"),
      }));
    },
    async getUser(name) {
      const result = await statement(`SHOW USERS LIKE ${literal(name)}`);
      const row = result.rows.find((row) => cell(row, "name") === name);
      if (!row) return null;
      return {
        name,
        status:
          cell(row, "status", "disabled") === "off"
            ? "ACTIVE"
            : cell(row, "status"),
        defaultRole: cell(row, "default_role"),
        defaultWarehouse: cell(row, "default_warehouse"),
      };
    },
    async createUser(input) {
      await statement(
        `CREATE USER ${ident(input.name)} PASSWORD = ${literal(input.password)}`,
      );
    },
    async suspendUser(name) {
      await statement(`ALTER USER ${ident(name)} SET DISABLED = TRUE`);
    },
    async resumeUser(name) {
      await statement(`ALTER USER ${ident(name)} SET DISABLED = FALSE`);
    },
    async listRoles() {
      const result = await statement("SHOW ROLES");
      return result.rows.map((row) => ({
        name: cell(row, "name"),
        owner: cell(row, "owner"),
      }));
    },
    async listGrants() {
      const result = await statement("SHOW GRANTS TO ROLE PUBLIC");
      return result.rows.map((row) => ({
        privilege: cell(row, "privilege"),
        grantedOn: cell(row, "granted_on"),
        name: cell(row, "name"),
        grantee: cell(row, "grantee_name"),
        grantOption: cell(row, "grant_option"),
      }));
    },
    async grantPrivilege(input) {
      await statement(grantSql("GRANT", input, input.to));
    },
    async revokePrivilege(input) {
      await statement(grantSql("REVOKE", input, input.from));
    },
    async listCopyHistory(database, schema, table) {
      const result = await statement(
        `SELECT file_name, table_name, status, row_count, error_count, last_load_time FROM SNOWFLAKE.ACCOUNT_USAGE.COPY_HISTORY WHERE table_catalog_name = ? AND table_schema_name = ?${table ? " AND table_name = ?" : ""} AND last_load_time >= DATEADD('day',-7,CURRENT_TIMESTAMP()) ORDER BY last_load_time DESC LIMIT 200`,
        table ? [database, schema, table] : [database, schema],
      );
      return result.rows.map((row) => ({
        file: cell(row, "file_name"),
        table: cell(row, "table_name"),
        status: cell(row, "status"),
        rows: Number(cell(row, "row_count") || 0),
        errors: Number(cell(row, "error_count") || 0),
        timestamp: cell(row, "last_load_time"),
      }));
    },
    async warehouseSpend(days) {
      const result = await statement(
        `SELECT warehouse_name, SUM(credits_used) AS credits, CURRENT_DATE() AS day FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY WHERE start_time >= DATEADD('day',-?,CURRENT_TIMESTAMP()) GROUP BY warehouse_name ORDER BY credits DESC`,
        [z.number().int().min(1).max(365).parse(days)],
      );
      return result.rows.map((row) => ({
        warehouse: cell(row, "warehouse_name"),
        credits: Number(cell(row, "credits") || 0),
        day: cell(row, "day"),
      }));
    },
    async listBudgets() {
      const result = await statement("SHOW BUDGETS IN ACCOUNT");
      return result.rows.map((row) => ({
        name: cell(row, "name"),
        limit: Number(cell(row, "limit") || 0),
        spent: Number(cell(row, "spent") || 0),
      }));
    },
    async listMonitors() {
      const result = await statement("SHOW RESOURCE MONITORS");
      return result.rows.map((row) => ({
        name: cell(row, "name"),
        quota: Number(cell(row, "credit_quota") || 0),
        used: Number(cell(row, "used_credits") || 0),
        status: cell(row, "level", "status"),
      }));
    },
    async suspendMonitor(name) {
      await statement(`ALTER RESOURCE MONITOR ${ident(name)} SUSPEND`);
    },
    async resumeMonitor(name) {
      await statement(`ALTER RESOURCE MONITOR ${ident(name)} RESUME`);
    },
    async execute(sql, options) {
      return statement(sql, [], options);
    },
  };
}
