import {
  Button,
  definePage,
  List,
  PageHeader,
  Stack,
} from "@northgraindata/dsui-adapter-sdk";
import { deleteApp } from "../actions/apps.js";
import { dashboards, tasks } from "../resources/apps.js";

export const dashboardListPage = definePage({
  path: "/dashboards",
  render: () =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "Dashboards",
          description: "Browse and manage dashboards deployed on Shaper.",
          actions: Button({
            label: "New dashboard",
            link: "/dashboards/new",
            variant: "primary",
          }),
        }),
        List({
          source: dashboards(),
          noun: "dashboard",
          searchable: true,
          pageSize: 25,
          filters: [{ field: "visibilityLabel", label: "Visibility" }],
          item: {
            icon: "layers",
            title: "name",
            badge: "visibilityLabel",
            description: "location",
            meta: ["updatedAt"],
          },
          rowLink: { path: "/dashboards/:id", params: { id: "id" } },
          rowActions: [
            {
              label: "Edit",
              icon: "edit",
              link: {
                path: "/dashboards/:id/edit",
                params: { id: "id" },
              },
            },
            {
              label: "Delete",
              icon: "close",
              variant: "danger",
              action: deleteApp,
              input: { id: "id", type: "type" },
              confirmation: {
                title: "Delete dashboard?",
                description:
                  "The dashboard is removed from Shaper. This cannot be undone.",
                confirmLabel: "Delete",
              },
            },
          ],
        }),
      ],
    }),
});

export const taskListPage = definePage({
  path: "/tasks",
  render: () =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "Tasks",
          description: "Scheduled SQL tasks and their latest run.",
          actions: Button({
            label: "New task",
            link: "/tasks/new",
            variant: "primary",
          }),
        }),
        List({
          source: tasks(),
          noun: "task",
          searchable: true,
          pageSize: 25,
          filters: [{ field: "statusLabel", label: "Status" }],
          item: {
            icon: "clock",
            title: "name",
            description: "location",
            meta: ["lastRunAt", "lastRunDuration"],
            status: {
              label: "statusLabel",
              tone: "statusTone",
              detail: "nextRunLabel",
            },
          },
          rowLink: { path: "/tasks/:id/edit", params: { id: "id" } },
          rowActions: [
            {
              label: "Delete",
              icon: "close",
              variant: "danger",
              action: deleteApp,
              input: { id: "id", type: "type" },
              confirmation: {
                title: "Delete task?",
                description: "The task and its schedule are removed.",
                confirmLabel: "Delete",
              },
            },
          ],
        }),
      ],
    }),
});
