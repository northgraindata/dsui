import {
  Button,
  Card,
  Columns,
  definePage,
  Grid,
  KeyValue,
  PageHeader,
  QueryEditor,
  ResourceTree,
  Section,
  SplitPane,
  Stack,
  Table,
  Tabs,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import { runQuery } from "./actions.js";
import {
  columns,
  databases,
  previewRows,
  relations,
  schemas,
  serverInfo,
  warehouses,
} from "./resources.js";

function explorer(selectedPath: string) {
  return ResourceTree({
    label: "Data explorer",
    stateKey: "snowflake-data-explorer",
    selectedPath,
    searchPlaceholder: "Search databases, schemas, relations...",
    branch: {
      source: databases(),
      nameField: "name",
      rowLink: { path: "/data/:database", params: { database: "name" } },
      children: {
        source: schemas({ database: "$name" }),
        nameField: "name",
        rowLink: {
          path: "/data/:database/:schema",
          params: { database: "database", schema: "name" },
        },
        children: {
          source: relations({ database: "$database", schema: "$name" }),
          nameField: "name",
          typeField: "kind",
          rowLink: {
            path: "/data/:database/:schema/:relation",
            params: {
              database: "database",
              schema: "schema",
              relation: "name",
            },
          },
        },
      },
    },
  });
}

export const overviewPage = definePage({
  path: "/",
  render: () => [
    Grid({
      content: [
        Card({
          variant: "metric",
          icon: "database",
          title: "Database",
          content: Value({ source: serverInfo(), field: "database" }),
        }),
        Card({
          variant: "metric",
          icon: "layers",
          title: "Warehouse",
          content: Value({ source: serverInfo(), field: "warehouse" }),
        }),
        Card({
          variant: "metric",
          icon: "user",
          title: "Role",
          content: Value({ source: serverInfo(), field: "role" }),
        }),
      ],
    }),
    Columns({
      columns: [
        {
          weight: 1,
          content: Section({
            title: "Warehouses",
            description: "Warehouses available to the current role.",
            link: { label: "View all", path: "/warehouses" },
            content: Table({
              source: warehouses(),
              columns: [
                { id: "name", label: "Name" },
                { id: "size", label: "Size" },
                { id: "state", label: "Status" },
                { id: "autoSuspend", label: "Auto suspend (s)" },
              ],
              pageSize: 5,
            }),
          }),
        },
        {
          weight: 1,
          content: Section({
            title: "Databases",
            description: "Databases visible to the current role.",
            link: { label: "Browse data", path: "/data" },
            content: Table({
              source: databases(),
              columns: [
                { id: "name", label: "Name" },
                { id: "owner", label: "Owner" },
                { id: "createdOn", label: "Created" },
              ],
              rowLink: {
                path: "/data/:database",
                params: { database: "name" },
              },
              pageSize: 5,
            }),
          }),
        },
      ],
    }),
    Columns({
      columns: [
        {
          weight: 1,
          content: Section({
            title: "Quick actions",
            content: Stack({
              gap: "sm",
              content: [
                Button({
                  variant: "list-item",
                  label: "New query",
                  description: "Choose a warehouse and run SQL",
                  icon: "play",
                  link: "/query",
                }),
                Button({
                  variant: "list-item",
                  label: "Browse data",
                  description: "Explore databases, schemas, and tables",
                  icon: "database",
                  link: "/data",
                }),
                Button({
                  variant: "list-item",
                  label: "View warehouses",
                  description: "Check available compute",
                  icon: "layers",
                  link: "/warehouses",
                }),
              ],
            }),
          }),
        },
        {
          weight: 1,
          content: KeyValue({ title: "Session", source: serverInfo() }),
        },
      ],
    }),
  ],
});

export const warehousesPage = definePage({
  path: "/warehouses",
  render: () => [
    PageHeader({
      title: "Warehouses",
      description: "Compute available to the current Snowflake role.",
    }),
    Table({
      source: warehouses(),
      columns: [
        { id: "name", label: "Name" },
        { id: "size", label: "Size" },
        { id: "state", label: "Status" },
        { id: "autoSuspend", label: "Auto suspend (s)" },
      ],
      searchable: true,
    }),
  ],
});

export const dataPage = definePage({
  path: "/data",
  render: () =>
    SplitPane({
      sidebar: explorer("/data"),
      content: [
        PageHeader({
          title: "Data",
          description: "Browse databases, schemas, tables, and views.",
        }),
      ],
    }),
});

export const databasePage = definePage({
  path: "/data/:database",
  render: ({ params }) =>
    SplitPane({
      sidebar: explorer(`/data/${encodeURIComponent(params.database)}`),
      content: [
        PageHeader({ title: params.database, description: "Database schemas" }),
        Table({
          source: schemas({ database: params.database }),
          columns: [
            { id: "name", label: "Schema" },
            { id: "owner", label: "Owner" },
          ],
          rowLink: {
            path: "/data/:database/:schema",
            params: { database: "database", schema: "name" },
          },
          searchable: true,
        }),
      ],
    }),
});

export const schemaPage = definePage({
  path: "/data/:database/:schema",
  render: ({ params }) =>
    SplitPane({
      sidebar: explorer(
        `/data/${encodeURIComponent(params.database)}/${encodeURIComponent(params.schema)}`,
      ),
      content: [
        PageHeader({
          title: params.schema,
          description: `${params.database} / ${params.schema}`,
        }),
        Table({
          source: relations({
            database: params.database,
            schema: params.schema,
          }),
          columns: [
            { id: "name", label: "Name" },
            { id: "kind", label: "Type" },
            { id: "rowCount", label: "Rows" },
          ],
          rowLink: {
            path: "/data/:database/:schema/:relation",
            params: {
              database: "database",
              schema: "schema",
              relation: "name",
            },
          },
          searchable: true,
        }),
      ],
    }),
});

export const relationPage = definePage({
  path: "/data/:database/:schema/:relation",
  render: ({ params }) => {
    const input = {
      database: params.database,
      schema: params.schema,
      relation: params.relation,
    };
    return SplitPane({
      sidebar: explorer(
        `/data/${encodeURIComponent(params.database)}/${encodeURIComponent(params.schema)}/${encodeURIComponent(params.relation)}`,
      ),
      content: [
        PageHeader({
          title: params.relation,
          description: `${params.database} / ${params.schema} / ${params.relation}`,
        }),
        Tabs({
          variant: "detail",
          items: [
            {
              label: "Preview",
              content: Table({
                source: previewRows(input),
                variant: "data",
                pageSize: 100,
              }),
            },
            {
              label: "Columns",
              content: Table({
                source: columns(input),
                searchable: true,
                pageSize: 100,
              }),
            },
          ],
        }),
      ],
    });
  },
});

export const queryPage = definePage({
  path: "/query",
  render: ({ query }) => [
    PageHeader({
      title: "Query editor",
      description:
        "Choose a warehouse to run SQL with the configured database, schema, and role.",
    }),
    QueryEditor({
      language: "sql",
      value: query.get("sql") ?? undefined,
      action: runQuery,
      database: { source: warehouses(), label: "Warehouse" },
    }),
  ],
});
