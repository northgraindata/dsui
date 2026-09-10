import {
  ActionList,
  Button,
  CardList,
  Columns,
  definePage,
  Meter,
  PageHeader,
  Section,
  StatGrid,
  Table,
} from "@northgraindata/dsui-adapter-sdk";
import {
  databaseCards,
  extensionCards,
  overview,
  recentQueries,
  recentTables,
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
