import {
  Button,
  Card,
  Columns,
  definePage,
  Grid,
  List,
  Section,
  Stack,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import { overview, overviewDags } from "../resources/overview.js";
import { dagActions } from "./dags.js";

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
            content: List({
              source: overviewDags(),
              noun: "DAG",
              searchable: true,
              item: {
                icon: "network",
                title: "name",
                badge: "schedule",
                description: "description",
                status: {
                  label: "lastRunState",
                  tone: "lastRunTone",
                  detail: "lastRunLabel",
                },
              },
              rowLink: { path: "/dags/:dagId", params: { dagId: "dagId" } },
              rowActions: dagActions,
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
