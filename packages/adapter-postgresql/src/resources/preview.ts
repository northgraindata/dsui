import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLQueryResult } from "../client.js";
import type { PostgreSQLContext } from "../context.js";

export const relationPreview = defineResource<
  z.ZodObject<{
    schema: z.ZodString;
    relation: z.ZodString;
    maxRows: z.ZodDefault<z.ZodNumber>;
  }>,
  PostgreSQLQueryResult,
  PostgreSQLContext
>({
  id: "relation-preview",
  input: z.object({
    schema: z.string().min(1),
    relation: z.string().min(1),
    maxRows: z.number().int().positive().max(1_000).default(100),
  }),
  query: ({ schema, relation, maxRows }, ctx) =>
    ctx.client.previewRelation(schema, relation, maxRows),
});

export const databaseRelationPreview = defineResource<
  z.ZodObject<{
    database: z.ZodString;
    schema: z.ZodString;
    relation: z.ZodString;
    maxRows: z.ZodDefault<z.ZodNumber>;
  }>,
  PostgreSQLQueryResult,
  PostgreSQLContext
>({
  id: "database-relation-preview",
  input: z.object({
    database: z.string().min(1),
    schema: z.string().min(1),
    relation: z.string().min(1),
    maxRows: z.number().int().positive().max(1_000).default(100),
  }),
  query: ({ database, schema, relation, maxRows }, ctx) =>
    ctx.getClient(database).previewRelation(schema, relation, maxRows),
});

export const databaseRelationPreviewRows = defineResource<
  z.ZodObject<{
    database: z.ZodString;
    schema: z.ZodString;
    relation: z.ZodString;
    maxRows: z.ZodDefault<z.ZodNumber>;
  }>,
  Record<string, unknown>[],
  PostgreSQLContext
>({
  id: "database-relation-preview-rows",
  input: z.object({
    database: z.string().min(1),
    schema: z.string().min(1),
    relation: z.string().min(1),
    maxRows: z.number().int().positive().max(1_000).default(100),
  }),
  query: async ({ database, schema, relation, maxRows }, ctx) =>
    (await ctx.getClient(database).previewRelation(schema, relation, maxRows))
      .rows,
});
