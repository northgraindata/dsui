import {
  Button,
  Card,
  Columns,
  definePage,
  Grid,
  Meter,
  Resource,
  Section,
  Stack,
  Table,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import { runBuild } from "../actions/build.js";
import { dashboard, recentRuns } from "../resources/dashboard.js";

export const overviewPage = definePage({
  path: "/",
  render: () => [
    Grid({
      columns: 5,
      content: [
        Card({
          variant: "metric",
          icon: "table",
          title: "Models",
          content: Value({
            source: dashboard(),
            field: "models",
            format: "number",
            fallback: "Unavailable",
          }),
        }),
        Card({
          variant: "metric",
          icon: "check",
          title: "Tests",
          content: Value({
            source: dashboard(),
            field: "tests",
            format: "number",
            fallback: "Unavailable",
          }),
        }),
        Card({
          variant: "metric",
          icon: "database",
          title: "Sources",
          content: Value({
            source: dashboard(),
            field: "sources",
            format: "number",
            fallback: "Unavailable",
          }),
        }),
        Card({
          variant: "metric",
          icon: "folder",
          title: "Projects",
          content: Value({
            source: dashboard(),
            field: "projects",
            format: "number",
            fallback: "Unavailable",
          }),
        }),
        Card({
          variant: "metric",
          icon: "play",
          title: "Jobs",
          content: Value({
            source: dashboard(),
            field: "jobs",
            format: "number",
            fallback: "Unavailable",
          }),
        }),
      ],
    }),
    Columns({
      columns: [
        {
          weight: 2,
          content: Section({
            title: "Latest run",
            description: "The most recent execution reported by dbt.",
            link: { label: "View runs", path: "/runs" },
            content: Resource({
              source: dashboard(),
              content: Card({
                variant: "panel",
                title: { field: "latestStatus" },
                description: { field: "latestDuration" },
                content: Meter({ source: dashboard() }),
              }),
            }),
          }),
        },
        {
          content: Section({
            title: "Quick actions",
            content: Stack({
              gap: "sm",
              content: [
                Button({
                  variant: "list-item",
                  icon: "table",
                  label: "Browse models",
                  description: "Explore models from the manifest",
                  link: "/models",
                }),
                Button({
                  variant: "list-item",
                  icon: "file",
                  label: "Open artifacts",
                  description: "Inspect generated dbt artifacts",
                  link: "/artifacts",
                }),
                Button({
                  variant: "list-item",
                  icon: "activity",
                  label: "View run history",
                  description: "Inspect recent dbt executions",
                  link: "/runs",
                }),
                Button({
                  variant: "list-item",
                  icon: "play",
                  label: "Run dbt build",
                  description: "Run the configured dbt build workflow",
                  action: runBuild({}),
                  successLink: {
                    path: "/runs/:runId",
                    params: { runId: "runId" },
                  },
                }),
              ],
            }),
          }),
        },
      ],
    }),
    Section({
      title: "Recent runs",
      description: "Latest runs for this connection.",
      link: { label: "View all", path: "/runs" },
      content: Table({
        source: recentRuns(),
        columns: [
          { id: "status", label: "Status" },
          { id: "job", label: "Job" },
          { id: "cause", label: "Cause" },
          { id: "started", label: "Started" },
        ],
        rowLink: { path: "/runs/:runId", params: { runId: "id" } },
      }),
    }),
  ],
});
