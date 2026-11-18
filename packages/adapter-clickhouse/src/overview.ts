import { defineResource } from "@northgraindata/dsui-adapter-sdk";
import type { ClickHouseContext } from "./context.js";

// Keep dashboard aggregates within the same catalog scope as the explorer.
const scope =
  "({all:UInt8} OR database = {database:String}) AND ({system:UInt8} OR database NOT IN ('system', 'information_schema', 'INFORMATION_SCHEMA'))";
function params(ctx: ClickHouseContext) {
  return {
    all: ctx.config.databaseScope === "all" ? 1 : 0,
    database: ctx.config.database,
    system: ctx.config.showSystemDatabases ? 1 : 0,
  };
}

export const overview = defineResource({
  id: "overview",
  query: async (_, ctx: ClickHouseContext) => {
    const result = await ctx.client.execute(
      `SELECT countIf(engine NOT IN ('View', 'MaterializedView')) AS tables, countIf(engine IN ('View', 'MaterializedView')) AS views, formatReadableSize(ifNull(sum(total_bytes), 0)) AS size, formatReadableQuantity(ifNull(sum(total_rows), 0)) AS rows FROM system.tables WHERE ${scope}`,
      { params: params(ctx) },
    );
    const databases = await ctx.client.execute(
      "SELECT count() AS databases FROM system.databases WHERE ({all:UInt8} OR name = {database:String}) AND ({system:UInt8} OR name NOT IN ('system', 'information_schema', 'INFORMATION_SCHEMA'))",
      { params: params(ctx) },
    );
    return { ...result.rows[0], ...databases.rows[0] };
  },
});

export const databaseCards = defineResource({
  id: "database-cards",
  query: async (_, ctx: ClickHouseContext) =>
    (
      await ctx.client.execute(
        `SELECT d.name AS name, d.engine AS badge, concat(toString(countIf(t.name != '')), ' relations · ', formatReadableSize(ifNull(sum(t.total_bytes), 0))) AS description FROM system.databases AS d LEFT JOIN system.tables AS t ON d.name = t.database WHERE ({all:UInt8} OR d.name = {database:String}) AND ({system:UInt8} OR d.name NOT IN ('system', 'information_schema', 'INFORMATION_SCHEMA')) GROUP BY d.name, d.engine ORDER BY d.name`,
        { params: params(ctx), maxRows: 10_000 },
      )
    ).rows,
});

export const largestTables = defineResource({
  id: "largest-tables",
  query: async (_, ctx: ClickHouseContext) =>
    (
      await ctx.client.execute(
        `SELECT database, name, engine, total_rows AS rows, formatReadableSize(ifNull(total_bytes, 0)) AS size FROM system.tables WHERE ${scope} AND engine NOT IN ('View', 'MaterializedView') ORDER BY total_bytes DESC NULLS LAST, database, name LIMIT 5`,
        { params: params(ctx), maxRows: 5 },
      )
    ).rows,
});
