import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { TrinoContext } from "../context";
import { literal, qualified, quote } from "../sql";
export const catalogInput = z.object({ catalog: z.string().min(1) });
export const schemaInput = catalogInput.extend({ schema: z.string().min(1) });
export const relationInput = schemaInput.extend({
  name: z.string().min(1),
  kind: z.enum(["table", "view", "materialized-view"]).default("table"),
});
export const catalogs = defineResource({
  id: "catalogs",
  refresh: poll("30s"),
  query: async (_, ctx: TrinoContext) =>
    (await ctx.client.execute("SHOW CATALOGS", { maxRows: 10000 })).rows.map(
      (row) => ({ name: String(row.Catalog) }),
    ),
});
export const schemas = defineResource({
  id: "schemas",
  input: catalogInput,
  refresh: poll("30s"),
  query: async ({ catalog }, ctx: TrinoContext) =>
    (
      await ctx.client.execute(`SHOW SCHEMAS FROM ${quote(catalog)}`, {
        maxRows: 10000,
      })
    ).rows.map((row) => ({ name: String(row.Schema), catalog })),
});
export const relations = defineResource({
  id: "relations",
  input: schemaInput,
  refresh: poll("30s"),
  query: async ({ catalog, schema }, ctx: TrinoContext) =>
    (
      await ctx.client.execute(
        `SELECT table_name AS name, table_type AS type FROM ${quote(catalog)}.information_schema.tables WHERE table_schema=${literal(schema)} ORDER BY table_name`,
        { maxRows: 10000 },
      )
    ).rows.map((row) => ({ ...row, catalog, schema })),
});
export const relation = defineResource({
  id: "relation",
  input: relationInput,
  query: async (input, ctx: TrinoContext) => {
    const name = qualified(input.catalog, input.schema, input.name);
    const columns = await ctx.client.execute(`SHOW COLUMNS FROM ${name}`, {
      maxRows: 10000,
    });
    const optional = async (sql: string) => {
      try {
        return { result: await ctx.client.execute(sql, { maxRows: 1000 }) };
      } catch (error) {
        return {
          unavailable: error instanceof Error ? error.message : "Unavailable",
        };
      }
    };
    const [ddl, stats, preview] = await Promise.all([
      optional(
        `SHOW CREATE ${input.kind === "view" ? "VIEW" : input.kind === "materialized-view" ? "MATERIALIZED VIEW" : "TABLE"} ${name}`,
      ),
      optional(`SHOW STATS FOR ${name}`),
      optional(`SELECT * FROM ${name} LIMIT 100`),
    ]);
    return { columns, ddl, stats, preview };
  },
});
export const relationColumns = defineResource({
  id: "relation-columns",
  input: relationInput,
  query: async (input, ctx: TrinoContext) => {
    const result = await ctx.client.execute(
      `SHOW COLUMNS FROM ${qualified(input.catalog, input.schema, input.name)}`,
      { maxRows: 10000 },
    );
    return result.rows;
  },
});
export const relationPreview = defineResource({
  id: "relation-preview",
  input: relationInput,
  query: async (input, ctx: TrinoContext) => {
    const result = await ctx.client.execute(
      `SELECT * FROM ${qualified(input.catalog, input.schema, input.name)} LIMIT 100`,
      { maxRows: 100 },
    );
    return result.rows;
  },
});
export const relationStats = defineResource({
  id: "relation-stats",
  input: relationInput,
  query: async (input, ctx: TrinoContext) => {
    const result = await ctx.client.execute(
      `SHOW STATS FOR ${qualified(input.catalog, input.schema, input.name)}`,
      { maxRows: 1000 },
    );
    return result.rows;
  },
});
export const relationDdl = defineResource({
  id: "relation-ddl",
  input: relationInput,
  query: async (input, ctx: TrinoContext) => {
    const type =
      input.kind === "view"
        ? "VIEW"
        : input.kind === "materialized-view"
          ? "MATERIALIZED VIEW"
          : "TABLE";
    const result = await ctx.client.execute(
      `SHOW CREATE ${type} ${qualified(input.catalog, input.schema, input.name)}`,
      { maxRows: 1 },
    );
    return result.rows;
  },
});
export const properties = defineResource({
  id: "properties",
  input: catalogInput,
  query: async ({ catalog }, ctx: TrinoContext) => {
    const properties = await ctx.client.execute(
      `SELECT * FROM system.metadata.table_properties WHERE catalog_name=${literal(catalog)}`,
      { maxRows: 1000 },
    );
    const materializedViews = await ctx.client.execute(
      `SELECT * FROM system.metadata.materialized_views WHERE catalog_name=${literal(catalog)}`,
      { maxRows: 1000 },
    );
    return { properties, materializedViews };
  },
});
export const monitorInput = z.object({
  view: z.enum([
    "cluster",
    "stats",
    "queries",
    "query",
    "workers",
    "worker",
    "threads",
    "task",
  ]),
  queryId: z.string().min(1).optional(),
  nodeId: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
});
export const monitor = defineResource({
  id: "monitor",
  input: monitorInput,
  refresh: poll("2s"),
  query: async (input, ctx: TrinoContext) => {
    const required = (value: string | undefined, label: string) => {
      if (!value) throw new Error(`${label} is required`);
      return encodeURIComponent(value);
    };
    const path =
      input.view === "cluster"
        ? "cluster"
        : input.view === "stats"
          ? "stats"
          : input.view === "queries"
            ? "query"
            : input.view === "query"
              ? `query/${required(input.queryId, "Query ID")}`
              : input.view === "workers"
                ? "worker"
                : `worker/${required(input.nodeId, "Node ID")}${input.view === "worker" ? "/status" : input.view === "threads" ? "/thread" : `/task/${required(input.taskId, "Task ID")}`}`;
    return ctx.client.ui(path);
  },
});
export const clusterOverview = defineResource({
  id: "cluster-overview",
  refresh: poll("2s"),
  query: async (_, ctx: TrinoContext) => {
    const [cluster, stats] = await Promise.all([
      ctx.client.ui("cluster"),
      ctx.client.ui("stats"),
    ]);
    const asRecord = (value: unknown): Record<string, unknown> =>
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const clusterValues = asRecord(cluster);
    const statsValues = asRecord(stats);
    const version = asRecord(clusterValues.nodeVersion);
    return {
      version: version?.version ?? "Unknown",
      environment: clusterValues.environment ?? "Unknown",
      uptime: clusterValues.uptime ?? "Unknown",
      runningQueries: statsValues.runningQueries ?? 0,
      queuedQueries: statsValues.queuedQueries ?? 0,
      blockedQueries: statsValues.blockedQueries ?? 0,
      activeWorkers: statsValues.activeWorkers ?? 0,
      activeCoordinators: statsValues.activeCoordinators ?? 0,
      reservedMemory: statsValues.reservedMemory ?? "0B",
      runningDrivers: statsValues.runningDrivers ?? 0,
      totalInputRows: statsValues.totalInputRows ?? 0,
      totalInputBytes: statsValues.totalInputBytes ?? 0,
      totalCpuTimeSecs: statsValues.totalCpuTimeSecs ?? 0,
    };
  },
});
export const queryActivity = defineResource({
  id: "query-activity",
  refresh: poll("2s"),
  query: async (_, ctx: TrinoContext) => {
    const result = await ctx.client.ui("query");
    const rows = Array.isArray(result) ? result : [];
    return rows
      .map((value) => {
        const query = value as Record<string, unknown>;
        const stats = (query.queryStats ?? {}) as Record<string, unknown>;
        return {
          queryId: String(query.queryId ?? ""),
          state: String(query.state ?? "UNKNOWN"),
          user: String(query.sessionUser ?? ""),
          source: String(query.sessionSource ?? ""),
          resourceGroup: Array.isArray(query.resourceGroupId)
            ? query.resourceGroupId.join("/")
            : String(query.resourceGroupId ?? ""),
          progress: stats.progressPercentage ?? null,
          elapsed: stats.elapsedTime ?? "",
          cpu: stats.totalCpuTime ?? "",
          memory: stats.userMemoryReservation ?? "",
          created: stats.createTime ?? "",
          query: String(query.queryTextPreview ?? query.query ?? ""),
        };
      })
      .sort((left, right) =>
        String(right.created).localeCompare(String(left.created)),
      );
  },
});
export const workerNodes = defineResource({
  id: "worker-nodes",
  refresh: poll("5s"),
  query: async (_, ctx: TrinoContext) => {
    const result = await ctx.client.ui("worker");
    return Array.isArray(result) ? result : [];
  },
});
export const resources = [
  catalogs,
  schemas,
  relations,
  relation,
  relationColumns,
  relationPreview,
  relationStats,
  relationDdl,
  properties,
  monitor,
  clusterOverview,
  queryActivity,
  workerNodes,
];
