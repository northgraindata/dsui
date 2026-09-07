import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "../context.js";

export const databases = defineResource({
  id: "databases",
  query: (_input: undefined, ctx: SnowflakeContext) =>
    ctx.client.listDatabases(),
  refresh: poll("60s"),
});

export const schemas = defineResource({
  id: "schemas",
  input: z.object({ database: z.string() }),
  query: ({ database }, ctx: SnowflakeContext) =>
    ctx.client.listSchemas(database),
  refresh: poll("60s"),
});

export const tables = defineResource({
  id: "tables",
  input: z.object({ database: z.string(), schema: z.string() }),
  query: ({ database, schema }, ctx: SnowflakeContext) =>
    ctx.client.listTables(database, schema),
  refresh: poll("60s"),
});

export const tableDetails = defineResource({
  id: "table-details",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    table: z.string(),
  }),
  query: ({ database, schema, table }, ctx: SnowflakeContext) =>
    ctx.client.getTable(database, schema, table),
});

export const tablePreview = defineResource({
  id: "table-preview",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    table: z.string(),
  }),
  query: ({ database, schema, table }, ctx: SnowflakeContext) =>
    ctx.client.previewTable(database, schema, table),
});

export const databaseDetails = defineResource({
  id: "database-details",
  input: z.object({ database: z.string() }),
  query: ({ database }, ctx: SnowflakeContext) =>
    ctx.client.getDatabase(database),
});

export const tableColumns = defineResource({
  id: "table-columns",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    table: z.string(),
  }),
  query: ({ database, schema, table }, ctx: SnowflakeContext) =>
    ctx.client.getColumns(database, schema, table),
});

export const views = defineResource({
  id: "views",
  input: z.object({ database: z.string(), schema: z.string() }),
  query: ({ database, schema }, ctx: SnowflakeContext) =>
    ctx.client.listViews(database, schema),
  refresh: poll("60s"),
});

export const viewDetails = defineResource({
  id: "view-details",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    view: z.string(),
  }),
  query: ({ database, schema, view }, ctx: SnowflakeContext) =>
    ctx.client.getView(database, schema, view),
});

export const sequences = defineResource({
  id: "sequences",
  input: z.object({ database: z.string(), schema: z.string() }),
  query: ({ database, schema }, ctx: SnowflakeContext) =>
    ctx.client.listSequences(database, schema),
});

export const materializedViews = defineResource({
  id: "materialized-views",
  input: z.object({ database: z.string(), schema: z.string() }),
  query: ({ database, schema }, ctx: SnowflakeContext) =>
    ctx.client.listMaterializedViews(database, schema),
});

export const fileFormats = defineResource({
  id: "file-formats",
  input: z.object({ database: z.string(), schema: z.string() }),
  query: ({ database, schema }, ctx: SnowflakeContext) =>
    ctx.client.listFileFormats(database, schema),
});

export const tableDdl = defineResource({
  id: "table-ddl",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    table: z.string(),
  }),
  query: ({ database, schema, table }, ctx: SnowflakeContext) =>
    ctx.client.getTableDdl(database, schema, table),
});
