import {
  defineComponent,
  type ResourceReference,
} from "@northgraindata/dsui-adapter-sdk";

export const DbtDashboardMetrics = defineComponent<{
  source: ResourceReference;
}>({ id: "dbt/dashboard-metrics", path: "./dashboard-metrics-view.tsx" });

export type RunHistoryDay = {
  date: string;
  label: string;
  success: number;
  warning: number;
  error: number;
};

export const DbtRunHistoryChart = defineComponent<{
  history: readonly RunHistoryDay[];
}>({ id: "dbt/run-history-chart", path: "./run-history-chart-view.tsx" });
