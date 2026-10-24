import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "./context.js";

const databaseInput = z.object({ database: z.string().min(1) });
const schemaInput = databaseInput.extend({ schema: z.string().min(1) });
const relationInput = schemaInput.extend({ relation: z.string().min(1) });

export const serverInfo = defineResource<
  Record<string, unknown>,
  SnowflakeContext
>({
  id: "server-info",
  query: (_, ctx) => ctx.client.serverInfo(),
});

export const databases = defineResource<
  Awaited<ReturnType<SnowflakeContext["client"]["listDatabases"]>>,
  SnowflakeContext
>({
  id: "databases",
  query: (_, ctx) => ctx.client.listDatabases(),
});

export const warehouses = defineResource<
  Awaited<ReturnType<SnowflakeContext["client"]["listWarehouses"]>>,
  SnowflakeContext
>({
  id: "warehouses",
  query: async (_, ctx) => {
    const visible = await ctx.client.listWarehouses();
    return visible.sort(
      (a, b) =>
        Number(b.name === ctx.defaultWarehouse) -
        Number(a.name === ctx.defaultWarehouse),
    );
  },
});

export const schemas = defineResource<
  typeof databaseInput,
  Awaited<ReturnType<SnowflakeContext["client"]["listSchemas"]>>,
  SnowflakeContext
>({
  id: "schemas",
  input: databaseInput,
  query: ({ database }, ctx) => ctx.client.listSchemas(database),
});

export const relations = defineResource<
  typeof schemaInput,
  Awaited<ReturnType<SnowflakeContext["client"]["listRelations"]>>,
  SnowflakeContext
>({
  id: "relations",
  input: schemaInput,
  query: ({ database, schema }, ctx) =>
    ctx.client.listRelations(database, schema),
});

export const columns = defineResource<
  typeof relationInput,
  Awaited<ReturnType<SnowflakeContext["client"]["listColumns"]>>,
  SnowflakeContext
>({
  id: "columns",
  input: relationInput,
  query: ({ database, schema, relation }, ctx) =>
    ctx.client.listColumns(database, schema, relation),
});

export const previewRows = defineResource<
  typeof relationInput,
  Record<string, unknown>[],
  SnowflakeContext
>({
  id: "preview-rows",
  input: relationInput,
  query: ({ database, schema, relation }, ctx) =>
    ctx.client.preview(database, schema, relation, 100),
});
