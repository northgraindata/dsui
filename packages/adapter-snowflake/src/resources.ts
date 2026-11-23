import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { SnowflakeContext } from "./context.js";

const databaseInput = z.object({ database: z.string().min(1) });
const schemaInput = databaseInput.extend({ schema: z.string().min(1) });
const relationInput = schemaInput.extend({ relation: z.string().min(1) });

// Catalog objects change rarely; warehouse state changes more often.
const CATALOG_TTL_MS = 60_000;
const WAREHOUSE_TTL_MS = 15_000;
// ACCOUNT_USAGE itself lags by hours, so re-reading it often gains nothing.
const USAGE_TTL_MS = 300_000;

export const serverInfo = defineResource<
  Record<string, unknown>,
  SnowflakeContext
>({
  id: "server-info",
  query: (_, ctx) =>
    ctx.cache.get("server-info", CATALOG_TTL_MS, () => ctx.client.serverInfo()),
});

export const capabilities = defineResource<
  { accountUsage: boolean; accountUsageReason: string | null },
  SnowflakeContext
>({
  id: "capabilities",
  query: async (_, ctx) => {
    const access = await ctx.client.accountUsageAccess();
    return {
      accountUsage: access.available,
      accountUsageReason: access.reason,
    };
  },
});

export const activity = defineResource<
  Awaited<ReturnType<SnowflakeContext["client"]["listQueryHistory"]>>,
  SnowflakeContext
>({
  id: "activity",
  query: (_, ctx) => ctx.client.listQueryHistory(200),
  refresh: poll("5s"),
});

const queryInput = z.object({ queryId: z.string().uuid() });

export const queryDetail = defineResource<
  typeof queryInput,
  Record<string, unknown>,
  SnowflakeContext
>({
  id: "query-detail",
  input: queryInput,
  query: async ({ queryId }, ctx) => {
    const entry = await ctx.client.getQuery(queryId);
    if (!entry) throw new Error("Query not found in the recent history.");
    const { text: _text, canCancel: _canCancel, ...details } = entry;
    return details;
  },
});

// Collection/CodeBlock read arrays of records, so the SQL travels separately.
export const queryText = defineResource<
  typeof queryInput,
  { text: string; errorMessage: string }[],
  SnowflakeContext
>({
  id: "query-text",
  input: queryInput,
  query: async ({ queryId }, ctx) => {
    const entry = await ctx.client.getQuery(queryId);
    return entry
      ? [{ text: entry.text, errorMessage: entry.errorMessage ?? "" }]
      : [];
  },
});

export const databases = defineResource<
  Awaited<ReturnType<SnowflakeContext["client"]["listDatabases"]>>,
  SnowflakeContext
>({
  id: "databases",
  query: (_, ctx) =>
    ctx.cache.get("databases", CATALOG_TTL_MS, () =>
      ctx.client.listDatabases(),
    ),
});

export const warehouses = defineResource<
  Awaited<ReturnType<SnowflakeContext["client"]["listWarehouses"]>>,
  SnowflakeContext
>({
  id: "warehouses",
  query: async (_, ctx) => {
    const visible = await ctx.cache.get("warehouses", WAREHOUSE_TTL_MS, () =>
      ctx.client.listWarehouses(),
    );
    return visible.sort(
      (a, b) =>
        Number(b.name === ctx.defaultWarehouse) -
        Number(a.name === ctx.defaultWarehouse),
    );
  },
});

const warehouseInput = z.object({ warehouse: z.string().min(1) });

export const warehouseDetail = defineResource<
  typeof warehouseInput,
  Record<string, unknown>,
  SnowflakeContext
>({
  id: "warehouse-detail",
  input: warehouseInput,
  query: async ({ warehouse }, ctx) => {
    const found = await ctx.cache.get(
      `warehouse:${warehouse}`,
      WAREHOUSE_TTL_MS,
      () => ctx.client.getWarehouse(warehouse),
    );
    if (!found) throw new Error(`Warehouse ${warehouse} is not visible.`);
    return { ...found };
  },
});

const warehouseLoadInput = warehouseInput.extend({
  metric: z.enum(["running", "queued"]),
});

export const warehouseLoad = defineResource<
  typeof warehouseLoadInput,
  { time: number; value: number }[],
  SnowflakeContext
>({
  id: "warehouse-load",
  input: warehouseLoadInput,
  query: async ({ warehouse, metric }, ctx) =>
    (await ctx.client.warehouseLoad(warehouse)).map((sample) => ({
      time: sample.time,
      value: sample[metric],
    })),
  refresh: poll("60s"),
});

export const relationDetails = defineResource<
  typeof relationInput,
  Record<string, unknown>,
  SnowflakeContext
>({
  id: "relation-details",
  input: relationInput,
  query: async ({ database, schema, relation }, ctx) => {
    const details = await ctx.cache.get(
      `relation-details:${database}.${schema}.${relation}`,
      CATALOG_TTL_MS,
      () => ctx.client.relationDetails(database, schema, relation),
    );
    if (!details) throw new Error(`${schema}.${relation} was not found.`);
    return { ...details };
  },
});

// CodeBlock reads arrays of records, so the DDL is wrapped in one.
export const relationDdl = defineResource<
  typeof relationInput,
  { ddl: string }[],
  SnowflakeContext
>({
  id: "relation-ddl",
  input: relationInput,
  query: async ({ database, schema, relation }, ctx) => [
    {
      ddl: await ctx.cache.get(
        `relation-ddl:${database}.${schema}.${relation}`,
        CATALOG_TTL_MS,
        () => ctx.client.relationDdl(database, schema, relation),
      ),
    },
  ],
});

export const usageSummary = defineResource<
  Awaited<ReturnType<SnowflakeContext["client"]["usageSummary"]>>,
  SnowflakeContext
>({
  id: "usage-summary",
  query: (_, ctx) =>
    ctx.cache.get("usage-summary", USAGE_TTL_MS, () =>
      ctx.client.usageSummary(),
    ),
});

export const creditsByDay = defineResource<
  Awaited<ReturnType<SnowflakeContext["client"]["creditsByDay"]>>,
  SnowflakeContext
>({
  id: "credits-by-day",
  query: (_, ctx) =>
    ctx.cache.get("credits-by-day", USAGE_TTL_MS, () =>
      ctx.client.creditsByDay(),
    ),
});

export const creditsByWarehouse = defineResource<
  Awaited<ReturnType<SnowflakeContext["client"]["creditsByWarehouse"]>>,
  SnowflakeContext
>({
  id: "credits-by-warehouse",
  query: (_, ctx) =>
    ctx.cache.get("credits-by-warehouse", USAGE_TTL_MS, () =>
      ctx.client.creditsByWarehouse(),
    ),
});

export const storageByDatabase = defineResource<
  Awaited<ReturnType<SnowflakeContext["client"]["storageByDatabase"]>>,
  SnowflakeContext
>({
  id: "storage-by-database",
  query: (_, ctx) =>
    ctx.cache.get("storage-by-database", USAGE_TTL_MS, () =>
      ctx.client.storageByDatabase(),
    ),
});

export const slowQueries = defineResource<
  Awaited<ReturnType<SnowflakeContext["client"]["slowQueries"]>>,
  SnowflakeContext
>({
  id: "slow-queries",
  query: (_, ctx) =>
    ctx.cache.get("slow-queries", USAGE_TTL_MS, () => ctx.client.slowQueries()),
});

export const schemas = defineResource<
  typeof databaseInput,
  Awaited<ReturnType<SnowflakeContext["client"]["listSchemas"]>>,
  SnowflakeContext
>({
  id: "schemas",
  input: databaseInput,
  query: ({ database }, ctx) =>
    ctx.cache.get(`schemas:${database}`, CATALOG_TTL_MS, () =>
      ctx.client.listSchemas(database),
    ),
});

export const relations = defineResource<
  typeof schemaInput,
  Awaited<ReturnType<SnowflakeContext["client"]["listRelations"]>>,
  SnowflakeContext
>({
  id: "relations",
  input: schemaInput,
  query: ({ database, schema }, ctx) =>
    ctx.cache.get(`relations:${database}.${schema}`, CATALOG_TTL_MS, () =>
      ctx.client.listRelations(database, schema),
    ),
});

export const columns = defineResource<
  typeof relationInput,
  Awaited<ReturnType<SnowflakeContext["client"]["listColumns"]>>,
  SnowflakeContext
>({
  id: "columns",
  input: relationInput,
  query: ({ database, schema, relation }, ctx) =>
    ctx.cache.get(
      `columns:${database}.${schema}.${relation}`,
      CATALOG_TTL_MS,
      () => ctx.client.listColumns(database, schema, relation),
    ),
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
