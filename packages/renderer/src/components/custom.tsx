import { Surface } from "@northgraindata/dsui-ui";
import { lazy, Suspense, useMemo } from "react";
import { type RegistryViewProps, resolveView } from "../registry";

/**
 * Renders a `"custom"` node through the component registry. Unknown ids
 * render an explicit fallback instead of failing silently or blank.
 */
export function CustomView({
  client,
  node,
  renderNode,
}: {
  client: RegistryViewProps["client"];
  node: Extract<
    import("@northgraindata/dsui-core").PageNode,
    { kind: "custom" }
  >;
  renderNode: RegistryViewProps["renderNode"];
}) {
  const entry = resolveView(node.props.component);
  const LazyView = useMemo(
    () => (entry?.type === "lazy" ? lazy(entry.loader) : null),
    [entry],
  );
  if (!entry)
    return (
      <Surface className="p-4 text-[12px] text-unavailable" role="alert">
        Unknown component “{node.props.component}”. The adapter declaring it is
        not installed or did not register a browser entry.
      </Surface>
    );
  if (entry.type === "sync") {
    const View = entry.view;
    return <View client={client} node={node} renderNode={renderNode} />;
  }
  return (
    <Suspense
      fallback={
        <Surface className="p-5 text-[12px] text-secondary" aria-busy="true">
          Loading component…
        </Surface>
      }
    >
      {LazyView ? (
        <LazyView client={client} node={node} renderNode={renderNode} />
      ) : null}
    </Suspense>
  );
}
