import {
  Button,
  Card,
  Collection,
  Columns,
  definePage,
  Grid,
  Meter,
  Section,
  Stack,
  Table,
  Value,
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
    Grid({
      content: [
        Card({
          variant: "metric",
          icon: "database",
          title: "Database size",
          content: Value({
            source: overview(),
            field: "totalSize",
            format: "bytes",
          }),
        }),
        Card({
          variant: "metric",
          icon: "grid",
          title: "Schemas",
          content: Value({
            source: overview(),
            field: "schemas",
            format: "number",
          }),
        }),
        Card({
          variant: "metric",
          icon: "table",
          title: "Tables",
          content: Value({
            source: overview(),
            field: "tables",
            format: "number",
          }),
        }),
        Card({
          variant: "metric",
          icon: "eye",
          title: "Views",
          content: Value({
            source: overview(),
            field: "views",
            format: "number",
          }),
        }),
        Card({
          variant: "metric",
          icon: "layers",
          title: "Extensions",
          content: Value({
            source: overview(),
            field: "extensions",
            format: "number",
          }),
        }),
        Card({
          variant: "metric",
          icon: "cpu",
          title: "Threads",
          content: Value({
            source: overview(),
            field: "threads",
            format: "number",
          }),
        }),
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
            content: Grid({
              content: Collection({
                source: databaseCards(),
                content: Card({
                  variant: "interactive",
                  icon: { field: "icon" },
                  title: { field: "title" },
                  description: { field: "description" },
                  badge: { field: "badge" },
                  link: {
                    path: "/data/:database",
                    params: { database: "name" },
                  },
                }),
              }),
            }),
          }),
        },
        {
          weight: 1,
          content: Section({
            title: "Quick actions",
            content: Stack({
              gap: "sm",
              content: [
                Button({
                  variant: "list-item",
                  icon: "play",
                  label: "New query",
                  description: "Open the query editor",
                  link: "/query",
                  kbd: "⌘N",
                }),
                Button({
                  variant: "list-item",
                  icon: "folder",
                  label: "Browse data",
                  description: "Explore tables and schemas",
                  link: "/data",
                  kbd: "⌘B",
                }),
                Button({
                  variant: "list-item",
                  icon: "file",
                  label: "View files",
                  description: "Access database files",
                  link: "/files",
                  kbd: "⌘F",
                }),
                Button({
                  variant: "list-item",
                  icon: "gear",
                  label: "Manage extensions",
                  description: "Install and configure extensions",
                  link: "/extensions",
                }),
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
            content: Grid({
              columns: 2,
              content: Collection({
                source: extensionCards(),
                content: Card({
                  variant: "interactive",
                  icon: { field: "icon" },
                  title: { field: "title" },
                  description: { field: "description" },
                  badge: { field: "badge" },
                  badgeTone: { field: "badgeTone" },
                  link: {
                    path: "/extensions/:extension",
                    params: { extension: "name" },
                  },
                }),
              }),
            }),
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
