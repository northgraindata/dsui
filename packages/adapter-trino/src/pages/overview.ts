import {
  Button,
  Card,
  Columns,
  definePage,
  Grid,
  Resource,
  Section,
  Stack,
  Table,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import { clusterOverview, queryActivity } from "../resources/index.js";

const queryMetrics = [
  { field: "runningQueries", title: "Running queries", icon: "activity" },
  { field: "queuedQueries", title: "Queued queries", icon: "clock" },
  { field: "blockedQueries", title: "Blocked queries", icon: "warning" },
  { field: "activeWorkers", title: "Active workers", icon: "network" },
] as const;

const clusterMetrics = [
  "version",
  "environment",
  "uptime",
  "reservedMemory",
  "totalInputRows",
  "totalInputBytes",
  "totalCpuTimeSecs",
] as const;

export const overviewPage = definePage({
  path: "/",
  render: () => [
    Resource({
      source: clusterOverview(),
      content: [
        Grid({
          content: queryMetrics.map(({ field, title, icon }) =>
            Card({
              variant: "metric",
              title,
              icon,
              content: Value({ field, format: "number" }),
            }),
          ),
        }),
        Columns({
          columns: [
            {
              weight: 2,
              content: Section({
                title: "Cluster",
                description: "Live coordinator and query execution status.",
                content: Grid({
                  content: clusterMetrics.map((field) =>
                    Card({
                      variant: "metric",
                      title: field.replace(
                        /[A-Z]/g,
                        (character) => ` ${character.toLowerCase()}`,
                      ),
                      content: Value({ field, format: "text" }),
                    }),
                  ),
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
                      description: "Run SQL across connected catalogs",
                      link: "/query",
                      kbd: "⌘N",
                    }),
                    Button({
                      variant: "list-item",
                      icon: "activity",
                      label: "Query activity",
                      description: "Inspect active and recent queries",
                      link: "/activity",
                    }),
                    Button({
                      variant: "list-item",
                      icon: "database",
                      label: "Browse catalogs",
                      description: "Explore schemas and relations",
                      link: "/explorer",
                    }),
                    Button({
                      variant: "list-item",
                      icon: "network",
                      label: "Workers",
                      description: "Inspect coordinator and workers",
                      link: "/workers",
                    }),
                  ],
                }),
              }),
            },
          ],
        }),
      ],
    }),
    Section({
      title: "Recent queries",
      description: "Latest coordinator queries, refreshed every 2 seconds.",
      link: { label: "View activity", path: "/activity" },
      content: Table({
        source: queryActivity(),
        columns: [
          { id: "state", label: "State" },
          { id: "user", label: "User" },
          { id: "elapsed", label: "Elapsed" },
          { id: "progress", label: "Progress", format: "progress" },
          { id: "query", label: "SQL" },
        ],
        rowLink: { path: "/activity/:queryId", params: { queryId: "queryId" } },
        searchable: true,
        pageSize: 5,
      }),
    }),
  ],
});
