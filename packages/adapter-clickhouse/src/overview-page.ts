import {
  Button,
  Card,
  Collection,
  Columns,
  definePage,
  Grid,
  KeyValue,
  PageHeader,
  Section,
  Stack,
  Table,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import { databaseCards, largestTables, overview } from "./overview.js";
import { serverInfo } from "./resources.js";

function overviewMetrics() {
  return Grid({
    content: [
      Card({
        variant: "metric",
        icon: "database",
        title: "Data size",
        content: Value({
          source: overview(),
          field: "size",
        }),
      }),
      Card({
        variant: "metric",
        icon: "layers",
        title: "Databases",
        content: Value({
          source: overview(),
          field: "databases",
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
        icon: "grid",
        title: "Stored rows",
        content: Value({
          source: overview(),
          field: "rows",
          format: "number",
        }),
      }),
    ],
  });
}

function catalogAndActions() {
  return Columns({
    columns: [
      {
        weight: 2,
        content: Section({
          title: "Databases",
          description: "Databases visible from this connection.",
          link: { label: "Browse data", path: "/data" },
          content: Grid({
            columns: 2,
            content: Collection({
              source: databaseCards(),
              content: Card({
                variant: "interactive",
                icon: "database",
                title: { field: "name" },
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
                description: "Open the SQL editor",
                link: "/query",
              }),
              Button({
                variant: "list-item",
                icon: "folder",
                label: "Browse data",
                description: "Explore tables and views",
                link: "/data",
              }),
              Button({
                variant: "list-item",
                icon: "activity",
                label: "View activity",
                description: "Inspect running queries",
                link: "/activity",
              }),
            ],
          }),
        }),
      },
    ],
  });
}

function tablesAndServer() {
  return Columns({
    columns: [
      {
        weight: 2,
        content: Section({
          title: "Largest tables",
          description:
            "Metadata estimates on the connected endpoint. Views are excluded.",
          link: { label: "View all", path: "/data" },
          content: Table({
            source: largestTables(),
            columns: [
              { id: "name", label: "Table" },
              { id: "database", label: "Database" },
              { id: "engine", label: "Engine" },
              { id: "rows", label: "Rows" },
              { id: "size", label: "Size" },
            ],
            rowLink: {
              path: "/data/:database/:table",
              params: { database: "database", table: "name" },
            },
          }),
        }),
      },
      {
        weight: 1,
        content: KeyValue({ title: "Server", source: serverInfo() }),
      },
    ],
  });
}

export const overviewPage = definePage({
  path: "/",
  render: () => [
    PageHeader({
      title: "ClickHouse",
      description: "Your data catalog at a glance.",
    }),
    overviewMetrics(),
    catalogAndActions(),
    tablesAndServer(),
  ],
});
