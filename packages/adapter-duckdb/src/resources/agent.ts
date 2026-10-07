import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";

export const catalogInput = z.object({
  database: z.string().min(1),
  schema: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  query: z.string().max(200).default(""),
  minColumns: z.number().int().min(0).max(10_000).default(0),
  maxColumns: z.number().int().min(0).max(10_000).optional(),
  offset: z.number().int().min(0).max(1_000_000).default(0),
  limit: z.number().int().min(1).max(50).default(25),
});
export type CatalogInput = z.output<typeof catalogInput>;
export type CatalogTable = {
  database: string;
  schema: string;
  name: string;
  kind: "table" | "view";
  description: string | null;
  columnCount: number;
  estimatedRows: number | null;
  matchedColumns: string[];
};
export const catalogTables = defineResource({
  id: "catalog-tables",
  input: catalogInput,
  query: async (input, ctx: DuckDbContext) => {
    const rows = await ctx.client.searchCatalog(input);
    return {
      items: rows.slice(0, input.limit),
      nextOffset: rows.length > input.limit ? input.offset + input.limit : null,
    };
  },
});

export const tableConstraints = defineResource({
  id: "table-constraints",
  input: z.object({
    database: z.string().min(1),
    schema: z.string().min(1),
    table: z.string().min(1),
  }),
  query: (input, ctx: DuckDbContext) =>
    ctx.client.getConstraints(input.database, input.schema, input.table),
});
