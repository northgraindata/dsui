/**
 * Browser entry for the dbt adapter.
 *
 * DSUI injects its single shared React instance, so this file only maps
 * component ids to implementations. The keys must match the `id` of each
 * `defineComponent` that declares a `path`; the build fails when one is
 * missing, so a component can never silently stop rendering.
 */
import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import ModelCatalog from "./components/model-catalog-view";
import ModelWorkspace from "./components/model-workspace-view";
import DependencyGraph from "./components/dependency-graph-view";
import DashboardMetrics from "./components/dashboard-metrics-view";
import RunHistoryChart from "./components/run-history-chart-view";

export function createComponents(React: typeof import("react")) {
  return {
    "dbt/dashboard-metrics": (props: ComponentProps) =>
      React.createElement(DashboardMetrics, props),
    "dbt/run-history-chart": (props: ComponentProps) =>
      React.createElement(RunHistoryChart, props),
    "dbt/model-catalog": (props: ComponentProps) =>
      React.createElement(ModelCatalog, props),
    "dbt/model-workspace": (props: ComponentProps) =>
      React.createElement(ModelWorkspace, props),
    "dbt/dependency-graph": (props: Record<string, unknown>) =>
      React.createElement(DependencyGraph as never, props as never),
  };
}
