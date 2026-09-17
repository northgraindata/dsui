import {
  Button,
  Card,
  Columns,
  definePage,
  Grid,
  KeyValue,
  Meter,
  PageHeader,
  Section,
  Stack,
  Table,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import { activity } from "../resources/activity.js";
import { capabilities } from "../resources/capabilities.js";
import { databases } from "../resources/catalog.js";
import { connectionUsage, overview } from "../resources/overview.js";
import { serverInfo } from "../resources/server.js";

export const overviewPage = definePage({
  path: "/",
  render: () => [
    PageHeader({
      title: "PostgreSQL",
      description:
        "A live view of this PostgreSQL server and its data catalog.",
    }),
    Grid({
      content: [
        Card({
          variant: "metric",
          icon: "database",
          title: "Database size",
          content: Value({ source: overview(), field: "databaseSize" }),
        }),
        Card({
          variant: "metric",
          icon: "layers",
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
          icon: "search",
          title: "Indexes",
          content: Value({
            source: overview(),
            field: "indexes",
            format: "number",
          }),
        }),
        Card({
          variant: "metric",
          icon: "activity",
          title: "Active connections",
          content: Value({
            source: overview(),
            field: "activeConnections",
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
            title: "Databases",
            description: "Databases visible from the configured connection.",
            link: { label: "Browse data", path: "/data" },
            content: Table({
              source: databases(),
              columns: [
                { id: "name", label: "Database" },
                { id: "owner", label: "Owner" },
                { id: "encoding", label: "Encoding" },
                { id: "sizeBytes", label: "Size" },
                { id: "allowConnections", label: "Connections" },
              ],
              searchable: true,
              pageSize: 5,
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
                  kbd: "⌘N",
                }),
                Button({
                  variant: "list-item",
                  icon: "activity",
                  label: "View activity",
                  description: "Inspect live sessions",
                  link: "/activity",
                }),
                Button({
                  variant: "list-item",
                  icon: "database",
                  label: "Browse databases",
                  description: "Explore schemas and relations",
                  link: "/data",
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
            title: "Live activity",
            description: "Sessions refreshed every second.",
            link: { label: "View all", path: "/activity" },
            content: Table({
               source: activity({ state: "active" }),
               columns: [
                 { id: "database", label: "Database" },
                 { id: "state", label: "State" },
                 { id: "runningFor", label: "Running for", format: "duration" },
                 { id: "progressPercent", label: "Progress", format: "progress" },
                 { id: "etaSeconds", label: "ETA", format: "eta" },
                 { id: "query", label: "Query" },
               ],
              searchable: true,
              pageSize: 5,
            }),
          }),
        },
        {
          weight: 1,
          content: Section({
            title: "Connection usage",
            description: "Current sessions against the server limit.",
            content: Meter({ source: connectionUsage() }),
          }),
        },
      ],
    }),
    Columns({
      columns: [
        {
          weight: 1,
          content: KeyValue({ title: "Server", source: serverInfo() }),
        },
        {
          weight: 1,
          content: KeyValue({ title: "Capabilities", source: capabilities() }),
        },
      ],
    }),
  ],
});
