import {
  Button,
  definePage,
  PageHeader,
  Stack,
} from "@northgraindata/dsui-adapter-sdk";
import { ShaperAppEditor, ShaperDashboard } from "../components.js";

export const dashboardViewPage = definePage({
  path: "/dashboards/:id",
  render: ({ params }) => ShaperDashboard({ id: params.id ?? "" }),
});

export const dashboardEditPage = definePage({
  path: "/dashboards/:id/edit",
  render: ({ params }) =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "Edit dashboard",
          actions: Button({ label: "All dashboards", link: "/dashboards" }),
        }),
        ShaperAppEditor({ type: "dashboard", id: params.id ?? "" }),
      ],
    }),
});

export const dashboardNewPage = definePage({
  path: "/dashboards/new",
  render: () =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "New dashboard",
          description: "Write the dashboard as SQL. Validate it before saving.",
          actions: Button({ label: "All dashboards", link: "/dashboards" }),
        }),
        ShaperAppEditor({ type: "dashboard" }),
      ],
    }),
});

export const taskEditPage = definePage({
  path: "/tasks/:id/edit",
  render: ({ params }) =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "Edit task",
          actions: Button({ label: "All tasks", link: "/tasks" }),
        }),
        ShaperAppEditor({ type: "task", id: params.id ?? "" }),
      ],
    }),
});

export const taskNewPage = definePage({
  path: "/tasks/new",
  render: () =>
    Stack({
      gap: "md",
      content: [
        PageHeader({
          title: "New task",
          description: "A task is SQL Shaper runs on a schedule.",
          actions: Button({ label: "All tasks", link: "/tasks" }),
        }),
        ShaperAppEditor({ type: "task" }),
      ],
    }),
});
