/**
 * Browser entry for the dbt adapter.
 *
 * DSUI injects its single shared React instance, so this file only maps
 * component ids to implementations. The keys must match the `id` of each
 * `defineComponent` that declares a `path`; the build fails when one is
 * missing, so a component can never silently stop rendering.
 */
import DependencyGraph from "./components/dependency-graph-view";

export function createComponents(React: typeof import("react")) {
  return {
    "airflow/dependency-graph": (props: Record<string, unknown>) =>
      React.createElement(DependencyGraph as never, props as never),
  };
}
