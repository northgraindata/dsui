import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { DuckDbContext } from "../context.js";
import { type CatalogTable, catalogInput } from "./agent.js";

const searchInput = catalogInput
  .omit({ name: true })
  .refine(
    (input) =>
      input.maxColumns === undefined || input.maxColumns >= input.minColumns,
    "maxColumns must be at least minColumns",
  );
const tableInput = z.object({
  database: z.string().min(1),
  schema: z.string().min(1),
  table: z.string().min(1),
});

function navigation(table: CatalogTable) {
  return {
    database: table.database,
    schema: table.schema,
    name: table.name,
    label: table.name,
    path: `/data/${[table.database, table.schema, table.kind === "view" ? "views" : "tables", table.name].map(segment).join("/")}`,
  };
}
function segment(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
async function search(input: z.output<typeof searchInput>, ctx: DuckDbContext) {
  const rows = await ctx.client.searchCatalog(input);
  const items = rows.slice(0, input.limit);
  return {
    navigation: items.map(navigation),
    data: {
      nextOffset: rows.length > input.limit ? input.offset + input.limit : null,
      items,
    },
  };
}
async function locate(input: z.output<typeof tableInput>, ctx: DuckDbContext) {
  const [table] = await ctx.client.searchCatalog(
    catalogInput.parse({ ...input, name: input.table, limit: 1 }),
  );
  if (!table) throw new Error("Table not found or inaccessible");
  return table;
}
export const searchCatalog = defineResource({
  id: "search-catalog",
  description:
    "Search table names, descriptions and column names in this DuckDB database. Discover databases first. Use nextOffset to paginate. Results include verified table navigation paths.",
  policy: "metadata",
  input: searchInput,
  query: search,
});
export const findTables = defineResource({
  id: "find-tables",
  description:
    "Find tables/views by schema, search text and inclusive column-count bounds. More than 10 columns means minColumns=11. Follow nextOffset for all results; row counts are estimates.",
  policy: "metadata",
  input: searchInput,
  query: search,
});
export const inspectTable = defineResource({
  id: "inspect-table",
  description:
    "Inspect an exact table: columns, types, constraints/keys, indexes, estimated row count and verified navigation path.",
  policy: "metadata",
  input: tableInput,
  query: async (input, ctx: DuckDbContext) => {
    const table = await locate(input, ctx);
    const columns = await ctx.client.getColumns(
      input.database,
      input.schema,
      input.table,
    );
    const constraints = await ctx.client.getConstraints(
      input.database,
      input.schema,
      input.table,
    );
    const indexes = (
      await ctx.client.listIndexes(input.database, input.schema)
    ).filter((index) => index.table === input.table);
    return {
      navigation: [navigation(table)],
      data: { ...table, columns, constraints, indexes },
    };
  },
});
export const previewTable = defineResource({
  id: "preview-table",
  description:
    "Read a bounded sample of 1–50 rows from an exact table. Display as a Markdown table by default; JSON only when requested. Samples are not the full dataset.",
  policy: "preview",
  input: tableInput.extend({
    limit: z.number().int().min(1).max(50).default(10),
  }),
  query: async (input, ctx: DuckDbContext) => {
    const table = await locate(input, ctx);
    return {
      navigation: [navigation(table)],
      data: {
        ...table,
        sampleOnly: true,
        limit: input.limit,
        ...(await ctx.client.previewTable(
          input.database,
          input.schema,
          input.table,
          input.limit,
        )),
      },
    };
  },
});
export const explorationResources = [
  searchCatalog,
  findTables,
  inspectTable,
  previewTable,
];
