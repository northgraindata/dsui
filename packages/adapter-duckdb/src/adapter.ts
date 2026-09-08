import {
  defineAction,
  defineAdapter,
  definePage,
  defineResource,
  Form,
  KeyValue,
  PageHeader,
  Table,
  TextInput,
  z,
} from "@northgraindata/dsui-adapter-sdk";

type QueryRow = Record<string, string | number>;

type MockDuckDb = {
  readonly database: string;
  readonly tables: Readonly<Record<string, readonly QueryRow[]>>;
};

const sampleTables: Readonly<Record<string, readonly QueryRow[]>> = {
  customers: [
    { id: 1, name: "Ada Lovelace", plan: "enterprise" },
    { id: 2, name: "Grace Hopper", plan: "team" },
    { id: 3, name: "Margaret Hamilton", plan: "starter" },
  ],
  orders: [
    { id: 1001, customer: "Ada Lovelace", amount: 129.5, status: "paid" },
    { id: 1002, customer: "Grace Hopper", amount: 89, status: "pending" },
    { id: 1003, customer: "Ada Lovelace", amount: 250, status: "paid" },
    {
      id: 1004,
      customer: "Margaret Hamilton",
      amount: 45,
      status: "refunded",
    },
  ],
};

function createMockDuckDb(database: string): MockDuckDb {
  return { database, tables: sampleTables };
}

function queryMockDatabase(sql: string, database: MockDuckDb) {
  const normalized = sql.trim().replace(/;$/, "");
  const match =
    /^select\s+(.+)\s+from\s+(customers|orders)(?:\s+limit\s+(\d+))?$/i.exec(
      normalized,
    );
  if (!match)
    throw new Error(
      "The mock supports SELECT queries from customers or orders, with an optional LIMIT.",
    );

  const [, selected, tableName, limit] = match;
  const rows = database.tables[tableName.toLowerCase()] ?? [];
  const columns =
    selected.trim() === "*"
      ? Object.keys(rows[0] ?? {})
      : selected.split(",").map((column) => column.trim());
  const count = limit ? Number(limit) : rows.length;
  return {
    columns,
    rows: rows
      .slice(0, count)
      .map((row) =>
        Object.fromEntries(
          columns.map((column) => [column, row[column] ?? null]),
        ),
      ),
  };
}

export const tables = defineResource({
  id: "tables",
  query: (_input, ctx: MockDuckDb) =>
    Object.entries(ctx.tables)
      .map(([name, rows]) => ({ name, rows: rows.length, type: "TABLE" }))
      .sort((left, right) => left.name.localeCompare(right.name)),
});

export const ordersPreview = defineResource({
  id: "orders-preview",
  query: (_input, ctx: MockDuckDb) => ctx.tables.orders ?? [],
});

export const databaseInfo = defineResource({
  id: "database-info",
  query: (_input, ctx: MockDuckDb) => ({
    database: ctx.database,
    engine: "DuckDB mock",
    tables: Object.keys(ctx.tables).length,
    mode: "Seeded demo data",
  }),
});

export const runQueryInput = z.object({ sql: z.string().min(1) });

export const runQuery = defineAction({
  id: "run-query",
  input: runQueryInput,
  run: ({ sql }, ctx: MockDuckDb) => queryMockDatabase(sql, ctx),
});

const queryPage = definePage({
  path: "/query",
  render: () => [
    PageHeader({
      title: "Query editor",
      description:
        "Run a seeded mock query to preview DSUI components. Try SELECT * FROM orders LIMIT 2.",
    }),
    Form({
      schema: runQueryInput,
      fields: [
        TextInput({
          name: "sql",
          label: "SQL",
          value: "SELECT * FROM orders LIMIT 2",
        }),
      ],
      onSubmit: runQuery,
      submitLabel: "Run query",
    }),
    Table({ source: ordersPreview() }),
  ],
});

const overviewPage = definePage({
  path: "/",
  render: () => [
    PageHeader({
      title: "DuckDB mock",
      description: "A local, seeded adapter for evaluating DSUI views.",
    }),
    KeyValue({ title: "Connection", source: databaseInfo() }),
    Table({ source: tables() }),
    Table({ source: ordersPreview() }),
  ],
});

const tablesPage = definePage({
  path: "/tables",
  render: () => [
    PageHeader({ title: "Tables", description: " mock catalog" }),
    Table({ source: tables() }),
  ],
});

const duckdbAdapter = defineAdapter({
  metadata: {
    id: "duckdb",
    name: "DuckDB",
    version: "0.1.0",
    author: "DSUI",
    iconUrl:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTslsfvRkdKKElpQlr5fwj1zcBJD0fbWCqJyUe-SnWBMQL0U3Bq7Rjlwc8m&s=10",
    description: "Seeded in-memory DuckDB-style mock for previewing DSUI.",
  },
  connectionSchema: z.object({
    database: z.string().min(1).default(":memory:"),
  }),
  context: ({ database }) => createMockDuckDb(database),
  resources: [tables, ordersPreview, databaseInfo],
  actions: [runQuery],
  pages: [overviewPage, queryPage, tablesPage],
});

export default duckdbAdapter;
