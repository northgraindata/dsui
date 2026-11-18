import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import { qualified, type Row } from "./client.js";
import type { ClickHouseContext } from "./context.js";
import { inspectionStatus } from "./errors.js";
import { databaseCards, largestTables, overview } from "./overview.js";
import { quoteIdentifier } from "./sql.js";

export const databaseInput = z.object({ database: z.string().min(1) });
export const tableInput = databaseInput.extend({ table: z.string().min(1) });

export const serverInfo = defineResource({
  id: "server-info",
  query: async (_, ctx: ClickHouseContext) =>
    (
      await ctx.client.execute(
        "SELECT version() AS version, currentUser() AS user, currentDatabase() AS database, timezone() AS timezone",
      )
    ).rows[0],
});
export const databases = defineResource({
  id: "databases",
  query: async (_, ctx: ClickHouseContext) =>
    (
      await ctx.client.execute(
        "SELECT name, engine FROM system.databases WHERE ({all:UInt8} OR name = {database:String}) AND ({system:UInt8} OR name NOT IN ('system', 'information_schema', 'INFORMATION_SCHEMA')) ORDER BY name",
        {
          params: {
            all: ctx.config.databaseScope === "all" ? 1 : 0,
            database: ctx.config.database,
            system: ctx.config.showSystemDatabases ? 1 : 0,
          },
          maxRows: 10_000,
        },
      )
    ).rows,
});
export const relations = defineResource({
  id: "relations",
  input: databaseInput,
  query: async ({ database }, ctx: ClickHouseContext) =>
    (
      await ctx.client.execute(
        "SELECT database, name, engine, multiIf(engine = 'MaterializedView', 'materialized-view', engine = 'View', 'view', engine = 'Dictionary', 'dictionary', 'table') AS kind, total_rows, total_bytes FROM system.tables WHERE database = {database:String} ORDER BY name",
        { database, params: { database }, maxRows: 10_000 },
      )
    ).rows,
});
export const columns = defineResource({
  id: "columns",
  input: tableInput,
  query: async (input, ctx: ClickHouseContext) =>
    (
      await ctx.client.execute(
        "SELECT name, type, position, default_kind, default_expression, comment, compression_codec, is_in_partition_key, is_in_sorting_key, is_in_primary_key, is_in_sampling_key FROM system.columns WHERE database = {database:String} AND table = {table:String} ORDER BY position",
        { database: input.database, params: input, maxRows: 10_000 },
      )
    ).rows,
});
export const preview = defineResource({
  id: "preview",
  input: tableInput,
  query: async (input, ctx: ClickHouseContext) =>
    (
      await ctx.client.execute(
        `SELECT * FROM ${qualified(input.database, input.table)} LIMIT 100`,
        { database: input.database, maxRows: 100 },
      )
    ).rows,
});
export const ddl = defineResource({
  id: "ddl",
  input: tableInput,
  query: async (input, ctx: ClickHouseContext) => [
    {
      ddl: (
        await ctx.client.execute(
          `SHOW CREATE TABLE ${qualified(input.database, input.table)}`,
          { database: input.database },
        )
      ).rows[0]?.statement,
    },
  ],
});
export const tableDetails = defineResource({
  id: "table-details",
  input: tableInput,
  query: async (input, ctx: ClickHouseContext) =>
    (
      await ctx.client.execute(
        "SELECT database, name, uuid, engine, engine_full, partition_key, sorting_key, primary_key, sampling_key, total_rows, total_bytes, metadata_modification_time, create_table_query FROM system.tables WHERE database = {database:String} AND name = {table:String}",
        { database: input.database, params: input },
      )
    ).rows[0],
});

export { isSystemView, systemViews, viewNames } from "./system-views.js";

import {
  isSystemView,
  type SystemView,
  systemViews,
  viewNames,
} from "./system-views.js";

type InspectionFilters = {
  database?: string;
  table?: string;
  queryId?: string;
  hours?: number;
};
function inspectionFilters(
  view: SystemView,
  available: Set<unknown>,
  filters: InspectionFilters,
  ctx: ClickHouseContext,
) {
  const definition: { columns: string[]; time?: string } = systemViews[view];
  const time = definition.time;
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  const databaseField = ["database", "current_database"].find((field) =>
    available.has(field),
  );
  if (filters.database && databaseField) {
    conditions.push(`${databaseField} = {database:String}`);
    params.database = filters.database;
  }
  if (filters.table && available.has("table")) {
    conditions.push("table = {table:String}");
    params.table = filters.table;
  }
  if (filters.queryId && available.has("query_id")) {
    conditions.push("query_id = {queryId:String}");
    params.queryId = filters.queryId;
  }
  if (view === "processes") {
    conditions.push("query_id != initialQueryID()");
  }
  if (time && available.has(time)) {
    conditions.push(
      `${quoteIdentifier(time)} >= now() - toIntervalHour({hours:UInt32})`,
    );
    params.hours = filters.hours ?? 24;
  }
  if (
    ctx.config.databaseScope === "selected" &&
    databaseField &&
    !filters.database
  ) {
    conditions.push(`${databaseField} = {database:String}`);
    params.database = ctx.config.database;
  }
  return { conditions, params };
}

export async function inspectSystem(
  view: SystemView,
  ctx: ClickHouseContext,
  filters: {
    database?: string;
    table?: string;
    queryId?: string;
    hours?: number;
  } = {},
): Promise<Row[]> {
  const definition: { columns: string[]; time?: string } = systemViews[view];
  const metadata = await ctx.client.execute(
    "SELECT name FROM system.columns WHERE database = 'system' AND table = {view:String}",
    { params: { view }, maxRows: 1000 },
  );
  const available = new Set(metadata.rows.map((row) => row.name));
  const selected = definition.columns.filter((column) => available.has(column));
  if (!selected.length) {
    await ctx.client.execute(
      `SELECT 1 FROM system.${quoteIdentifier(view)} LIMIT 0`,
    );
    throw new Error(
      `system.${view} has no supported visible columns on this server.`,
    );
  }
  const { conditions, params } = inspectionFilters(
    view,
    available,
    filters,
    ctx,
  );
  const database = filters.database ?? ctx.config.database;
  if (view === "processes") {
    params.canKill = await canKillAllQueries(ctx);
    selected.push("__can_cancel");
  }
  const rows = (
    await ctx.client.execute(
      `SELECT ${selected.map((column) => (column === "__can_cancel" ? "(user = currentUser() OR {canKill:UInt8}) AS can_cancel" : quoteIdentifier(column))).join(", ")} FROM system.${quoteIdentifier(view)}${conditions.length ? ` WHERE ${conditions.join(" AND ")}` : ""}${definition.time && available.has(definition.time) ? ` ORDER BY ${quoteIdentifier(definition.time)} DESC` : ""} LIMIT 1000`,
      { database, params, maxRows: 1000 },
    )
  ).rows;
  if (view !== "settings" && view !== "server_settings") return rows;
  return rows.map((row) =>
    typeof row.name === "string" &&
    /password|secret|token|private_key|access_key|connection_string|credential|headers/i.test(
      row.name,
    )
      ? { ...row, value: "[redacted]" }
      : row,
  );
}
export const inspections = viewNames.map((name) => {
  if (!isSystemView(name)) throw new Error("Unknown inspection");
  return defineResource({
    id: `inspect-${name}`,
    input: z.object({
      database: z.string().optional(),
      table: z.string().optional(),
      queryId: z.string().optional(),
      hours: z.number().int().min(1).max(168).optional(),
    }),
    refresh: "live" in systemViews[name] ? poll("5s") : undefined,
    query: (filters, ctx: ClickHouseContext) =>
      inspectSystem(name, ctx, filters),
  });
});
export const capabilities = defineResource({
  id: "capabilities",
  query: async (_, ctx: ClickHouseContext) =>
    Promise.all(
      viewNames.map(async (name) => {
        if (!isSystemView(name)) throw new Error("Unknown inspection");
        try {
          await ctx.client.execute(
            `SELECT 1 FROM system.${quoteIdentifier(name)} LIMIT 1`,
            { maxRows: 1 },
          );
          return { name, status: "available" };
        } catch (error) {
          return { name, status: inspectionStatus(error) };
        }
      }),
    ),
});
export const catalogResources = [
  overview,
  databaseCards,
  largestTables,
  serverInfo,
  databases,
  relations,
  columns,
  preview,
  ddl,
  tableDetails,
  capabilities,
  ...inspections,
];

async function canKillAllQueries(ctx: ClickHouseContext): Promise<number> {
  try {
    return (await ctx.client.execute("CHECK GRANT KILL QUERY", { maxRows: 1 }))
      .rows[0]?.result === 1
      ? 1
      : 0;
  } catch {
    return 0;
  }
}
