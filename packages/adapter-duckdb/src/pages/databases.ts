import {
  ActionList,
  Button,
  CardList,
  Columns,
  definePage,
  KeyValue,
  Meter,
  PageHeader,
  Section,
  SplitPane,
  StatGrid,
  Table,
  Tabs,
} from "@northgraindata/dsui-adapter-sdk";
import { dataExplorer } from "../components/data-explorer.js";
import {
  databaseCards,
  databaseDetails,
  databaseSize,
  extensionCards,
  overview,
  recentQueries,
  recentTables,
  relations,
  schemas,
  storageMeter,
} from "../resources/catalog.js";

export const overviewPage = definePage({
  path: "/",
  render: () => [
    PageHeader({
      title: "DuckDB",
      description: "Fast, in-process analytics database.",
      badge: { label: "Connected", tone: "healthy" },
      actions: [
        Button({ label: "New query", variant: "primary", link: "/query" }),
        Button({ label: "Browse data", link: "/data" }),
        Button({ label: "Attach database", link: "/admin" }),
      ],
    }),
    StatGrid({
      source: overview(),
      items: [
        { icon: "database", field: "totalSize", label: "Database size" },
        { icon: "grid", field: "schemas", label: "Schemas" },
        { icon: "table", field: "tables", label: "Tables" },
        { icon: "eye", field: "views", label: "Views" },
        { icon: "layers", field: "extensions", label: "Extensions" },
        { icon: "cpu", field: "threads", label: "Threads" },
      ],
    }),
    Columns({
      columns: [
        {
          weight: 2,
          content: Section({
            title: "Attached databases",
            description: "Databases available in this DuckDB instance.",
            link: { label: "Attach database", path: "/admin" },
            content: CardList({ source: databaseCards() }),
          }),
        },
        {
          weight: 1,
          content: Section({
            title: "Quick actions",
            content: ActionList({
              items: [
                {
                  icon: "play",
                  title: "New query",
                  description: "Open the query editor",
                  link: "/query",
                  kbd: "⌘N",
                },
                {
                  icon: "folder",
                  title: "Browse data",
                  description: "Explore tables and schemas",
                  link: "/data",
                  kbd: "⌘B",
                },
                {
                  icon: "file",
                  title: "View files",
                  description: "Access database files",
                  link: "/files",
                  kbd: "⌘F",
                },
                {
                  icon: "gear",
                  title: "Manage extensions",
                  description: "Install and configure extensions",
                  link: "/extensions",
                },
              ],
            }),
          }),
        },
      ],
    }),
    Columns({
      columns: [
        {
          weight: 2,
          content: Section({
            title: "Recent tables",
            description: "Tables in any attached database, by row count.",
            link: { label: "View all", path: "/data" },
            content: Table({
              source: recentTables({ limit: 5 }),
              columns: [
                { id: "name", label: "Name" },
                { id: "database", label: "Database" },
                { id: "rows", label: "Rows" },
              ],
              rowLink: {
                path: "/data/:database/:schema/:relationType/:relation",
                params: {
                  database: "database",
                  schema: "schema",
                  relationType: "relationType",
                  relation: "relation",
                },
              },
            }),
          }),
        },
        {
          weight: 1,
          content: Section({
            title: "Recent queries",
            link: { label: "View all", path: "/activity" },
            content: Table({
              source: recentQueries({ limit: 5 }),
              columns: [
                { id: "query", label: "Query" },
                { id: "age", label: "" },
                { id: "duration", label: "" },
              ],
            }),
          }),
        },
      ],
    }),
    Columns({
      columns: [
        {
          weight: 2,
          content: Section({
            title: "Extensions",
            description: "Installed extensions in this instance.",
            link: { label: "View all", path: "/extensions" },
            content: CardList({ source: extensionCards(), columns: 2 }),
          }),
        },
        {
          weight: 1,
          content: Section({
            title: "Storage usage",
            description: "Database file size on disk.",
            content: Meter({ source: storageMeter({}) }),
          }),
        },
      ],
    }),
  ],
});

export const dataPage = definePage({
  path: "/data",
  render: () =>
    SplitPane({
      sidebar: dataExplorer("/data"),
      content: [
        PageHeader({
          title: "Data",
          description:
            "Browse DuckDB and attached databases from a single hierarchy.",
        }),
        KeyValue({
          title: "Explorer",
          data: {
            navigation: "Select a database, schema, table, or view.",
            search: "Search across the catalog from the explorer.",
          },
        }),
      ],
    }),
});

export const databasePage = definePage({
  path: "/data/:database",
  render: ({ params }) =>
    SplitPane({
      sidebar: dataExplorer(`/data/${encodeURIComponent(params.database)}`),
      content: [
        PageHeader({
          title: params.database,
          description: "Database · select a schema to browse its objects.",
        }),
        Tabs({
          items: [
            {
              label: "Overview",
              content: [
                KeyValue({
                  source: databaseDetails({ database: params.database }),
                }),
                KeyValue({
                  title: "Storage",
                  source: databaseSize({ database: params.database }),
                }),
              ],
            },
            {
              label: "Schemas",
              content: Table({
                source: schemas({ database: params.database }),
                rowLink: {
                  path: "/data/:database/:schema",
                  params: { database: "database", schema: "name" },
                },
              }),
            },
          ],
        }),
      ],
    }),
});

export const schemaPage = definePage({
  path: "/data/:database/:schema",
  render: ({ params }) =>
    SplitPane({
      sidebar: dataExplorer(
        `/data/${encodeURIComponent(params.database)}/${encodeURIComponent(params.schema)}`,
      ),
      content: [
        PageHeader({
          title: params.schema,
          description: `${params.database} / ${params.schema}`,
        }),
        Tabs({
          items: [
            {
              label: "Objects",
              content: Table({
                source: relations({
                  database: params.database,
                  schema: params.schema,
                  type: "all",
                }),
                columns: [
                  { id: "name", label: "Name" },
                  { id: "type", label: "Type" },
                ],
                rowLink: {
                  path: "/data/:database/:schema/:relationType/:relation",
                  params: {
                    database: "database",
                    schema: "schema",
                    relationType: "relationType",
                    relation: "relation",
                  },
                },
              }),
            },
            {
              label: "Overview",
              content: KeyValue({
                data: { database: params.database, schema: params.schema },
              }),
            },
          ],
        }),
      ],
    }),
});
