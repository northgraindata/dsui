import { defineComponent } from "@northgraindata/dsui-adapter-sdk";

/** Native renderer for a dashboard evaluated by the Shaper server. */
export const ShaperDashboard = defineComponent<{ id: string; title?: string }>({
  id: "shaper/dashboard",
  path: "./components/dashboard-view.tsx",
});

/** SQL editor for creating or changing a dashboard or task. */
export const ShaperAppEditor = defineComponent<{
  type: "dashboard" | "task";
  id?: string;
}>({
  id: "shaper/app-editor",
  path: "./components/app-editor.tsx",
});
