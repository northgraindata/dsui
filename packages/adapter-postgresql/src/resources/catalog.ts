import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type {
  PostgreSQLColumn,
  PostgreSQLConstraint,
  PostgreSQLDatabase,
  PostgreSQLIndex,
  PostgreSQLRelation,
  PostgreSQLSchema,
} from "../client.js";
import type { PostgreSQLContext } from "../context.js";

export const databases = defineResource<
  PostgreSQLDatabase[],
  PostgreSQLContext
>({
  id: "databases",
  query: (_, ctx) => ctx.client.listDatabases(ctx.config.databaseScope),
});

export const schemas = defineResource<PostgreSQLSchema[], PostgreSQLContext>({
  id: "schemas",
  query: (_, ctx) => ctx.client.listSchemas(),
});

export const databaseSchemas = defineResource<
  z.ZodObject<{ database: z.ZodString }>,
  PostgreSQLSchema[],
  PostgreSQLContext
>({
  id: "database-schemas",
  input: z.object({ database: z.string().min(1) }),
  query: ({ database }, ctx) => ctx.getClient(database).listSchemas(),
});

export const relations = defineResource<
  z.ZodObject<{ schema: z.ZodString }>,
  PostgreSQLRelation[],
  PostgreSQLContext
>({
  id: "relations",
  input: z.object({ schema: z.string().min(1) }),
  query: ({ schema }, ctx) => ctx.client.listRelations(schema),
});

export const databaseRelations = defineResource<
  z.ZodObject<{ database: z.ZodString; schema: z.ZodString }>,
  PostgreSQLRelation[],
  PostgreSQLContext
>({
  id: "database-relations",
  input: z.object({
    database: z.string().min(1),
    schema: z.string().min(1),
  }),
  query: ({ database, schema }, ctx) =>
    ctx.getClient(database).listRelations(schema),
});

export const columns = defineResource<
  z.ZodObject<{ schema: z.ZodString; relation: z.ZodString }>,
  PostgreSQLColumn[],
  PostgreSQLContext
>({
  id: "columns",
  input: z.object({
    schema: z.string().min(1),
    relation: z.string().min(1),
  }),
  query: ({ schema, relation }, ctx) =>
    ctx.client.listColumns(schema, relation),
});

export const databaseColumns = defineResource<
  z.ZodObject<{
    database: z.ZodString;
    schema: z.ZodString;
    relation: z.ZodString;
  }>,
  PostgreSQLColumn[],
  PostgreSQLContext
>({
  id: "database-columns",
  input: z.object({
    database: z.string().min(1),
    schema: z.string().min(1),
    relation: z.string().min(1),
  }),
  query: ({ database, schema, relation }, ctx) =>
    ctx.getClient(database).listColumns(schema, relation),
});

export const indexes = defineResource<
  z.ZodObject<{ schema: z.ZodString; relation: z.ZodString }>,
  PostgreSQLIndex[],
  PostgreSQLContext
>({
  id: "indexes",
  input: z.object({
    schema: z.string().min(1),
    relation: z.string().min(1),
  }),
  query: ({ schema, relation }, ctx) =>
    ctx.client.listIndexes(schema, relation),
});

export const databaseIndexes = defineResource<
  z.ZodObject<{
    database: z.ZodString;
    schema: z.ZodString;
    relation: z.ZodString;
  }>,
  PostgreSQLIndex[],
  PostgreSQLContext
>({
  id: "database-indexes",
  input: z.object({
    database: z.string().min(1),
    schema: z.string().min(1),
    relation: z.string().min(1),
  }),
  query: ({ database, schema, relation }, ctx) =>
    ctx.getClient(database).listIndexes(schema, relation),
});

export const constraints = defineResource<
  z.ZodObject<{ schema: z.ZodString; relation: z.ZodString }>,
  PostgreSQLConstraint[],
  PostgreSQLContext
>({
  id: "constraints",
  input: z.object({
    schema: z.string().min(1),
    relation: z.string().min(1),
  }),
  query: ({ schema, relation }, ctx) =>
    ctx.client.listConstraints(schema, relation),
});

export const databaseConstraints = defineResource<
  z.ZodObject<{
    database: z.ZodString;
    schema: z.ZodString;
    relation: z.ZodString;
  }>,
  PostgreSQLConstraint[],
  PostgreSQLContext
>({
  id: "database-constraints",
  input: z.object({
    database: z.string().min(1),
    schema: z.string().min(1),
    relation: z.string().min(1),
  }),
  query: ({ database, schema, relation }, ctx) =>
    ctx.getClient(database).listConstraints(schema, relation),
});
