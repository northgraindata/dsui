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

export const relations = defineResource<
  z.ZodObject<{ schema: z.ZodString }>,
  PostgreSQLRelation[],
  PostgreSQLContext
>({
  id: "relations",
  input: z.object({ schema: z.string().min(1) }),
  query: ({ schema }, ctx) => ctx.client.listRelations(schema),
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
