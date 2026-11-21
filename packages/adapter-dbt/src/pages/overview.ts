import {
  Badge,
  Button,
  Card,
  Grid,
  PageHeader,
  Section,
  Table,
  definePage,
} from "@northgraindata/dsui-adapter-sdk";
import { runBuild } from "../actions/build.js";
import { dashboard, recentRuns } from "../resources/dashboard.js";
import { DbtDashboardMetrics } from "../components/dashboard-metrics.js";

export const overviewPage = definePage({
  path: "/",
  render: () => [
    PageHeader({
      title: "dbt",
      description: "Monitor builds, models and transformations.",
      actions: Button({
        label: "Run dbt build",
        icon: "play",
        variant: "primary",
        action: runBuild({}),
        successLink: { path: "/runs/:runId", params: { runId: "runId" } },
      }),
    }),
    DbtDashboardMetrics({ source: dashboard() }),
    Section({
      title: "Recent runs",
      description: "The latest dbt executions.",
      link: { label: "All runs", path: "/runs" },
      content: Table({
        source: recentRuns(),
        variant: "plain",
        columns: [
          { id: "job", label: "Job" },
          {
            id: "status",
            label: "Status",
            renderCell: Badge({
              label: { field: "status" },
              tone: { field: "tone" },
              dot: true,
            }),
          },
          { id: "cause", label: "Trigger" },
          { id: "started", label: "Started (UTC)" },
        ],
        rowLink: { path: "/runs/:runId", params: { runId: "id" } },
      }),
    }),
    Section({
      title: "Quick actions",
      content: Grid({
        content: [
          Card({
            variant: "interactive",
            icon: "table",
            title: "Browse models",
            description: "Explore the model catalog",
            link: { path: "/models", params: {} },
          }),
          Card({
            variant: "interactive",
            icon: "file",
            title: "Open artifacts",
            description: "Inspect dbt artifacts",
            link: { path: "/artifacts", params: {} },
          }),
          Card({
            variant: "interactive",
            icon: "network",
            title: "View lineage",
            description: "Trace model dependencies",
            link: { path: "/lineage", params: {} },
          }),
          Card({
            variant: "interactive",
            icon: "history",
            title: "Run history",
            description: "Review previous executions",
            link: { path: "/runs", params: {} },
          }),
        ],
      }),
    }),
  ],
});
