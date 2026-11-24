/**
 * Browser entry for the Shaper adapter.
 *
 * DSUI injects its single shared React instance, so this file only maps
 * component ids to implementations. The keys must match the `id` of each
 * `defineComponent` that declares a `path`.
 */
import AppEditor from "./components/app-editor";
import DashboardView from "./components/dashboard-view";

export function createComponents(React: typeof import("react")) {
  return {
    "shaper/dashboard": (props: Record<string, unknown>) =>
      React.createElement(DashboardView as never, props as never),
    "shaper/app-editor": (props: Record<string, unknown>) =>
      React.createElement(AppEditor as never, props as never),
  };
}
