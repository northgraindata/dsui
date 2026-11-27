import type { DeclarativePageRendererProps } from "../types/renderer-types";
import { PageNodeRenderer } from "./page-node-renderer";

export function DeclarativePageRenderer({
  client,
  nodes,
  layout = "page",
}: DeclarativePageRendererProps) {
  return (
    <div
      className={
        layout === "page"
          ? "dsui-page grid gap-component"
          : "grid gap-component"
      }
    >
      {nodes.map((node, index) => (
        <PageNodeRenderer
          // Declared nodes keep their place. A key derived from content would
          // remount the subtree, and drop its state, on any prop change.
          // biome-ignore lint/suspicious/noArrayIndexKey: static declared order
          key={`${index}:${node.kind}`}
          client={client}
          node={node}
        />
      ))}
    </div>
  );
}
