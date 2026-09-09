import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";

export const version = defineResource({
  id: "version",
  query: async (_input: undefined, ctx: DuckDbContext) => ({
    version: await ctx.client.version(),
  }),
});

export const databases = defineResource({
  id: "databases",
  query: async (_input: undefined, ctx: DuckDbContext) =>
    (await ctx.client.listDatabases()).filter(
      (database) => database.name !== "system" && database.name !== "temp",
    ),
  refresh: poll("30s"),
});

export const databaseSize = defineResource({
  id: "database-size",
  input: z.object({ database: z.string().optional() }),
  query: async ({ database }, ctx: DuckDbContext) =>
    (await ctx.client.databaseSize(database)).rows[0] ?? {},
});

export const overview = defineResource({
  id: "overview",
  query: (_input: undefined, ctx: DuckDbContext) => ctx.client.getOverview(),
});

export const databaseDetails = defineResource({
  id: "database-details",
  input: z.object({ database: z.string() }),
  query: async ({ database }, ctx: DuckDbContext) => {
    const details = await ctx.client.getDatabase(database);
    if (!details) throw new Error(`Database not found: ${database}`);
    return {
      type: details.internal ? "DuckDB" : "Attached",
      path: details.path ?? ":memory:",
      readOnly: details.readonly,
    };
  },
});

export const schemas = defineResource({
  id: "schemas",
  input: z.object({ database: z.string() }),
  query: ({ database }, ctx: DuckDbContext) => ctx.client.listSchemas(database),
});

export const tables = defineResource({
  id: "tables",
  input: z.object({
    database: z.string().default("memory"),
    schema: z.string().default("main"),
  }),
  query: ({ database, schema }, ctx: DuckDbContext) =>
    ctx.client.listTables(database, schema),
  refresh: poll("30s"),
});

export const views = defineResource({
  id: "views",
  input: z.object({
    database: z.string().default("memory"),
    schema: z.string().default("main"),
  }),
  query: ({ database, schema }, ctx: DuckDbContext) =>
    ctx.client.listViews(database, schema),
});

export const relations = defineResource({
  id: "relations",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    search: z.string().optional(),
    type: z.enum(["all", "table", "view"]).default("all"),
  }),
  query: async ({ database, schema, search, type }, ctx: DuckDbContext) => {
    const [tableRows, viewRows] = await Promise.all([
      type === "view" ? [] : ctx.client.listTables(database, schema),
      type === "table" ? [] : ctx.client.listViews(database, schema),
    ]);
    const needle = search?.trim().toLocaleLowerCase();
    return [
      ...tableRows.map((relation) => ({
        ...relation,
        type: "TABLE",
        relationType: "tables",
        relation: relation.name,
      })),
      ...viewRows.map((relation) => ({
        ...relation,
        type: "VIEW",
        relationType: "views",
        relation: relation.name,
      })),
    ]
      .filter(
        (relation) =>
          !needle || relation.name.toLocaleLowerCase().includes(needle),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  },
});

export const tableColumns = defineResource({
  id: "table-columns",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    table: z.string(),
  }),
  query: ({ database, schema, table }, ctx: DuckDbContext) =>
    ctx.client.getColumns(database, schema, table),
});

export const tablePreview = defineResource({
  id: "table-preview",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    table: z.string(),
    limit: z.number().int().min(1).max(1000).default(100),
  }),
  query: async ({ database, schema, table, limit }, ctx: DuckDbContext) =>
    (await ctx.client.previewTable(database, schema, table, limit)).rows,
});

export const tableDdl = defineResource({
  id: "table-ddl",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    table: z.string(),
  }),
  query: async ({ database, schema, table }, ctx: DuckDbContext) => ({
    sql: await ctx.client.getTableDdl(database, schema, table),
  }),
});

export const viewDdl = defineResource({
  id: "view-ddl",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    view: z.string(),
  }),
  query: async ({ database, schema, view }, ctx: DuckDbContext) => ({
    sql: await ctx.client.getViewDdl(database, schema, view),
  }),
});

export const columnProfile = defineResource({
  id: "column-profile",
  input: z.object({
    database: z.string(),
    schema: z.string(),
    table: z.string(),
  }),
  query: async ({ database, schema, table }, ctx: DuckDbContext) =>
    (await ctx.client.summarizeTable(database, schema, table)).rows,
});

export const sequences = defineResource({
  id: "sequences",
  input: z.object({
    database: z.string().default("memory"),
    schema: z.string().default("main"),
  }),
  query: ({ database, schema }, ctx: DuckDbContext) =>
    ctx.client.listSequences(database, schema),
});

export const indexes = defineResource({
  id: "indexes",
  input: z.object({
    database: z.string().default("memory"),
    schema: z.string().default("main"),
  }),
  query: ({ database, schema }, ctx: DuckDbContext) =>
    ctx.client.listIndexes(database, schema),
});

export const macros = defineResource({
  id: "macros",
  input: z.object({
    database: z.string().default("memory"),
    schema: z.string().default("main"),
  }),
  query: ({ database, schema }, ctx: DuckDbContext) =>
    ctx.client.listMacros(database, schema),
});

export const functions = defineResource({
  id: "functions",
  input: z.object({ search: z.string().optional() }),
  query: ({ search }, ctx: DuckDbContext) =>
    ctx.client.listFunctions(search ?? ""),
});

export const types = defineResource({
  id: "types",
  query: (_input: undefined, ctx: DuckDbContext) => ctx.client.listTypes(),
});
