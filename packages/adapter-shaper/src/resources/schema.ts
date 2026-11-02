import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";
import type { ShaperContext } from "../context.js";

const schemaInput = z.object({ database: z.string() });
const relationInput = z.object({
  database: z.string(),
  schema: z.string(),
  search: z.string().optional(),
});

export const databases = defineResource({
  id: "databases",
  description: "List DuckDB databases visible to the API key.",
  query: async (_input: undefined, ctx: ShaperContext) =>
    (await ctx.client.getSchema()).map((database) => ({
      name: database.name,
      schemaCount: database.schemas.length,
    })),
  refresh: poll("60s"),
});

export const schemas = defineResource({
  id: "schemas",
  input: schemaInput,
  query: async ({ database }, ctx: ShaperContext) =>
    (await ctx.client.getSchema())
      .filter((candidate) => candidate.name === database)
      .flatMap((candidate) =>
        candidate.schemas.map((namespace) => ({
          database,
          name: namespace.name,
          relationCount: namespace.relations.length,
        })),
      ),
});

export const relations = defineResource({
  id: "relations",
  description: "List tables and views of one schema.",
  input: relationInput,
  query: async ({ database, schema, search }, ctx: ShaperContext) => {
    const needle = search?.trim().toLocaleLowerCase();
    return (await ctx.client.getSchema())
      .filter((candidate) => candidate.name === database)
      .flatMap((candidate) => candidate.schemas)
      .filter((namespace) => namespace.name === schema)
      .flatMap((namespace) => namespace.relations)
      .filter(
        (relation) =>
          !needle || relation.name.toLocaleLowerCase().includes(needle),
      )
      .map((relation) => ({
        database,
        schema,
        name: relation.name,
        type: relation.kind === "view" ? "VIEW" : "TABLE",
        comment: relation.comment ?? "",
        columnCount: relation.columns.length,
      }));
  },
});
