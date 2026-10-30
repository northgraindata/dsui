/**
 * Browser entry for the Dagster adapter.
 *
 * DSUI injects its single shared React instance, so this file only maps
 * component ids to implementations. The keys must match the `id` of each
 * `defineComponent` that declares a `path`; the build fails when one is
 * missing, so a component can never silently stop rendering.
 */
import AssetGraph from "./components/asset-graph-view";

export function createComponents(React: typeof import("react")) {
  return {
    "dagster/asset-graph": (props: Record<string, unknown>) =>
      React.createElement(AssetGraph as never, props as never),
  };
}
