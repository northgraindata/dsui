import {
  Button,
  Card,
  Columns,
  definePage,
  Flex,
  Grid,
  List,
  Meter,
  Section,
  Stack,
  Value,
} from "@northgraindata/dsui-adapter-sdk";
import {
  failingTasks,
  overview,
  recentDashboards,
  taskHealth,
  upcomingTasks,
} from "../resources/apps.js";

function metric(icon: string, title: string, field: string) {
  return Card({
    variant: "metric",
    icon,
    title,
    content: Value({ source: overview(), field, format: "number" }),
  });
}

export const overviewPage = definePage({
  path: "/",
  render: () =>
    Stack({
      gap: "md",
      content: [
        Flex({
          gap: "sm",
          wrap: true,
          content: [
            Button({
              label: "New dashboard",
              icon: "plus",
              link: "/dashboards/new",
              variant: "primary",
            }),
            Button({
              label: "New task",
              icon: "plus",
              link: "/tasks/new",
              variant: "secondary",
            }),
            Button({
              label: "Run a query",
              icon: "terminal",
              link: "/query",
              variant: "secondary",
            }),
          ],
        }),
        Grid({
          columns: 4,
          content: [
            metric("layers", "Dashboards", "dashboards"),
            metric("clock", "Tasks", "tasks"),
            metric("warning", "Failing tasks", "failedTasks"),
            metric("pause", "Never run", "neverRun"),
          ],
        }),
        Columns({
          columns: [
            {
              weight: 3,
              content: Stack({
                gap: "md",
                content: [
                  Section({
                    title: "Task health",
                    link: { label: "All tasks", path: "/tasks" },
                    content: Meter({ source: taskHealth(), format: "number" }),
                  }),
                  Section({
                    title: "Needs attention",
                    description: "Tasks whose latest run failed.",
                    content: List({
                      source: failingTasks(),
                      noun: "failed task",
                      pageSize: 5,
                      item: {
                        icon: "warning",
                        title: "name",
                        description: "location",
                        meta: ["lastRunAt", "lastRunDuration"],
                        status: {
                          label: "statusLabel",
                          tone: "statusTone",
                        },
                      },
                      rowLink: {
                        path: "/tasks/:id/edit",
                        params: { id: "id" },
                      },
                    }),
                  }),
                ],
              }),
            },
            {
              weight: 2,
              content: Stack({
                gap: "md",
                content: [
                  Section({
                    title: "Upcoming runs",
                    content: List({
                      source: upcomingTasks(),
                      noun: "scheduled task",
                      pageSize: 5,
                      item: {
                        icon: "calendar",
                        title: "name",
                        description: "nextRunLabel",
                      },
                      rowLink: {
                        path: "/tasks/:id/edit",
                        params: { id: "id" },
                      },
                    }),
                  }),
                  Section({
                    title: "Recent dashboards",
                    link: { label: "All dashboards", path: "/dashboards" },
                    content: List({
                      source: recentDashboards(),
                      noun: "dashboard",
                      pageSize: 6,
                      item: {
                        icon: "layers",
                        title: "name",
                        description: "location",
                        meta: ["updatedAt"],
                      },
                      rowLink: {
                        path: "/dashboards/:id",
                        params: { id: "id" },
                      },
                    }),
                  }),
                ],
              }),
            },
          ],
        }),
      ],
    }),
});
