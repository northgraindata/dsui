import {
  type ActionRuntimeContext,
  defineAction,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";
import {
  databaseSize,
  databases,
  indexes,
  overview,
  relations,
  schemas,
  tables,
  views,
} from "../resources/catalog.js";

type Ctx = DuckDbContext & ActionRuntimeContext;

const qualified = z.object({
  database: z.string().default("memory"),
  schema: z.string().default("main"),
});

export const attachInput = z.object({
  source: z.string().min(1),
  alias: z.string().min(1),
  readOnly: z.boolean().default(false),
});

export const attachDatabase = defineAction({
  id: "attach",
  input: attachInput,
  run: async ({ source, alias, readOnly }, ctx: Ctx) => {
    await ctx.client.attach({ source, alias, readOnly });
    ctx.invalidate(databases);
    ctx.invalidate(schemas);
    ctx.invalidate(overview);
    return { alias, attached: true };
  },
});

export const detachDatabase = defineAction({
  id: "detach",
  input: z.object({ database: z.string().min(1) }),
  run: async ({ database }, ctx: Ctx) => {
    await ctx.client.detach(database);
    ctx.invalidate(databases);
    ctx.invalidate(databaseSize);
    ctx.invalidate(schemas);
    ctx.invalidate(relations);
    ctx.invalidate(overview);
    return { database, detached: true };
  },
});

export const createSchema = defineAction({
  id: "create-schema",
  input: qualified,
  run: async ({ database, schema }, ctx: Ctx) => {
    await ctx.client.execute(`CREATE SCHEMA ${scoped(database, schema)}`);
    ctx.invalidate(databases);
    return { schema, created: true };
  },
});

export const dropSchema = defineAction({
  id: "drop-schema",
  input: qualified,
  run: async ({ database, schema }, ctx: Ctx) => {
    await ctx.client.execute(`DROP SCHEMA ${scoped(database, schema)}`);
    ctx.invalidate(databases);
    return { schema, dropped: true };
  },
});

export const createTable = defineAction({
  id: "create-table",
  input: z.object({
    schema: z.string().default("main"),
    name: z.string().min(1),
    sql: z.string().min(1),
  }),
  run: async ({ schema, name, sql }, ctx: Ctx) => {
    await ctx.client.execute(sql);
    ctx.invalidate(tables);
    ctx.invalidate(relations);
    ctx.invalidate(overview);
    return { schema, name, created: true };
  },
});

export const dropTable = defineAction({
  id: "drop-table",
  input: qualified.extend({ table: z.string().min(1) }),
  run: async ({ database, schema, table }, ctx: Ctx) => {
    await ctx.client.execute(`DROP TABLE ${full(database, schema, table)}`);
    ctx.invalidate(tables);
    ctx.invalidate(relations);
    ctx.invalidate(databaseSize);
    ctx.invalidate(overview);
    return { table, dropped: true };
  },
});

export const createView = defineAction({
  id: "create-view",
  input: z.object({
    schema: z.string().default("main"),
    name: z.string().min(1),
    sql: z.string().min(1),
  }),
  run: async ({ name, sql }, ctx: Ctx) => {
    await ctx.client.execute(sql);
    ctx.invalidate(views);
    ctx.invalidate(relations);
    ctx.invalidate(overview);
    return { name, created: true };
  },
});

export const dropView = defineAction({
  id: "drop-view",
  input: qualified.extend({ view: z.string().min(1) }),
  run: async ({ database, schema, view }, ctx: Ctx) => {
    await ctx.client.execute(`DROP VIEW ${full(database, schema, view)}`);
    ctx.invalidate(views);
    ctx.invalidate(relations);
    ctx.invalidate(overview);
    return { view, dropped: true };
  },
});

export const createIndex = defineAction({
  id: "create-index",
  input: z.object({ name: z.string().min(1), sql: z.string().min(1) }),
  run: async ({ name, sql }, ctx: Ctx) => {
    await ctx.client.execute(sql);
    ctx.invalidate(indexes);
    return { name, created: true };
  },
});

export const dropIndex = defineAction({
  id: "drop-index",
  input: z.object({ index: z.string().min(1) }),
  run: async ({ index }, ctx: Ctx) => {
    await ctx.client.execute(`DROP INDEX ${index}`);
    ctx.invalidate(indexes);
    return { index, dropped: true };
  },
});

export const importData = defineAction({
  id: "import-data",
  input: z.object({
    table: z.string().min(1),
    source: z.string().min(1),
    format: z.enum(["CSV", "PARQUET", "JSON", "AUTO"]).default("AUTO"),
  }),
  run: async ({ table, source, format }, ctx: Ctx) => {
    await ctx.client.execute(
      `COPY ${table} FROM '${source}' (FORMAT ${format})`,
    );
    ctx.invalidate(tables);
    return { table, imported: true };
  },
});

function quote(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function scoped(database: string, schema: string): string {
  return `${quote(database)}.${quote(schema)}`;
}

function full(database: string, schema: string, name: string): string {
  return `${scoped(database, schema)}.${quote(name)}`;
}
