/**
 * Browser entry for the S3 adapter.
 *
 * DSUI injects its single shared React instance, so this file only maps
 * component ids to implementations. The keys must match the `id` of each
 * `defineComponent` that declares a `path`; the build fails when one is
 * missing, so a component can never silently stop rendering.
 */
import StorageWorkspace from "./components/storage-workspace";

export function createComponents(React: typeof import("react")) {
  return {
    "s3/storage-workspace": (props: Record<string, unknown>) =>
      React.createElement(StorageWorkspace as never, props as never),
  };
}
