import {
  Badge,
  Button,
  Card,
  Columns,
  definePage,
  Grid,
  Section,
  Stack,
  Table,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import { pauseDag, triggerDag, unpauseDag } from "../actions/dags.js";
import { overview, overviewDags } from "../resources/overview.js";

export const overviewPage = definePage({
  path: "/",
  render: () => [
    Grid({
      columns: 4,
      content: [
        Card({
          variant: "metric",
          icon: "grid",
          title: "Total DAGs",
          content: Value({
            source: overview(),
            field: "totalDags",
            format: "number",
          }),
        }),
        Card({
          variant: "metric",
          icon: "play",
          title: "Active",
          content: Value({
            source: overview(),
            field: "activeDags",
            format: "number",
          }),
        }),
        Card({
          variant: "metric",
          icon: "pause",
          title: "Paused",
          content: Value({
            source: overview(),
            field: "pausedDags",
            format: "number",
          }),
        }),
        Card({
          variant: "metric",
          icon: "warning",
          title: "Stale",
          content: Value({
            source: overview(),
            field: "staleDags",
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
            title: "DAGs",
            description: "Monitor schedules and trigger workflows.",
            link: { label: "View all", path: "/dags" },
            content: Table({
              source: overviewDags(),
              columns: [
                { id: "name", label: "DAG" },
                { id: "schedule", label: "Schedule" },
                { id: "lastRun", label: "Last run" },
                { id: "nextRun", label: "Next run" },
                {
                  id: "status",
                  label: "Status",
                  renderCell: Badge({
                    label: { field: "status" },
                    tone: { field: "statusTone" },
                    dot: true,
                  }),
                },
              ],
              rowLink: { path: "/dags/:dagId", params: { dagId: "dagId" } },
              rowActions: [
                {
                  action: triggerDag,
                  label: "Trigger",
                  icon: "play",
                  input: { dagId: "dagId" },
                  successLink: {
                    path: "/dags/:dagId?tab=graph&runId=:dagRunId",
                    params: { dagId: "dagId", dagRunId: "dagRunId" },
                  },
                },
                {
                  label: "Pause",
                  icon: "pause",
                  action: pauseDag,
                  input: { dagId: "dagId" },
                  when: { field: "isPaused", equals: false },
                },
                {
                  label: "Unpause",
                  icon: "reload",
                  action: unpauseDag,
                  input: { dagId: "dagId" },
                  when: { field: "isPaused", equals: true },
                },
              ],
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
                  icon: "grid",
                  label: "Manage DAGs",
                  description: "Browse workflows and trigger a run",
                  link: "/dags",
                }),
                Button({
                  variant: "list-item",
                  icon: "layers",
                  label: "Browse assets",
                  description: "Inspect Airflow assets and events",
                  link: "/assets",
                }),
              ],
            }),
          }),
        },
      ],
    }),
  ],
});
