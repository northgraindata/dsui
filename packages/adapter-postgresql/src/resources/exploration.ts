import { defineResource, z } from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLContext } from "../context.js";
import {
  agentReadonlyQuery,
  agentReadonlyQueryInput,
  type CatalogTable,
  catalogInput,
} from "./agent.js";

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
    path: `/data/${[table.database, table.schema, table.name].map(segment).join("/")}`,
  };
}
function segment(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

async function search(
  input: z.output<typeof searchInput>,
  ctx: PostgreSQLContext,
) {
  const rows = await ctx.getClient(input.database).searchCatalog(input);
  const items = rows.slice(0, input.limit);
  return {
    navigation: items.map(navigation),
    data: {
      nextOffset: rows.length > input.limit ? input.offset + input.limit : null,
      items,
    },
  };
}
async function locate(
  input: z.output<typeof tableInput>,
  ctx: PostgreSQLContext,
) {
  const client = ctx.getClient(input.database);
  const [table] = await client.searchCatalog(
    catalogInput.parse({ ...input, name: input.table, limit: 1 }),
  );
  if (!table) throw new Error("Table not found or inaccessible");
  return { client, table };
}

export const searchCatalog = defineResource({
  id: "search-catalog",
  description:
    "Search table names, descriptions and column names in this PostgreSQL database. Discover databases first. Use nextOffset to paginate. Results include verified table navigation paths.",
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
  query: async (input, ctx: PostgreSQLContext) => {
    const { client, table } = await locate(input, ctx);
    const columns = await client.listColumns(input.schema, input.table);
    const constraints = await client.listConstraints(input.schema, input.table);
    const indexes = await client.listIndexes(input.schema, input.table);
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
  query: async (input, ctx: PostgreSQLContext) => {
    const { client, table } = await locate(input, ctx);
    return {
      navigation: [navigation(table)],
      data: {
        ...table,
        sampleOnly: true,
        limit: input.limit,
        ...(await client.previewRelation(
          input.schema,
          input.table,
          input.limit,
        )),
      },
    };
  },
});
export const queryReadonly = defineResource({
  id: "query-readonly",
  description:
    "Opt-in PostgreSQL read-only SQL. Requires connection.allowAgentSql and a non-privileged role. Use schema-qualified tables, one SELECT/WITH query, only allowlisted built-in functions, no comments/semicolons. Default 50 rows/5s, max 200 rows/10s. Read agent-sql-capabilities to check service opt-in.",
  policy: "sql",
  input: agentReadonlyQueryInput,
  query: (input, ctx: PostgreSQLContext) =>
    agentReadonlyQuery.definition.query(input, ctx),
});
export const explorationResources = [
  searchCatalog,
  findTables,
  inspectTable,
  previewTable,
  queryReadonly,
];
