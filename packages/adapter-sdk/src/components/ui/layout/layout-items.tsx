import type { ReactNode } from "react";
import type { PageNode } from "../../nodes";
import type { ComponentProps } from "../../runtime";
import { positioned } from "../keys";

/**
 * Data-binding nodes only fetch and repeat their content. Their wrapper must not
 * take part in layout, so the parent's gap and sizing apply to what they render.
 */
export const LAYOUT_NEUTRAL_KINDS: ReadonlySet<string> = new Set([
  "collection",
  "resource",
]);

export function asNodes(
  value: PageNode | readonly PageNode[],
): readonly PageNode[] {
  return "kind" in value ? [value] : value;
}

/** The single item wrapper shared by every layout container. */
export function LayoutItems({
  content,
  client,
  renderNode,
  context,
}: Pick<ComponentProps, "client" | "renderNode" | "context"> & {
  content: PageNode | readonly PageNode[];
}): ReactNode {
  return positioned(asNodes(content)).map(({ item: child, key }) => (
    <div
      className={
        LAYOUT_NEUTRAL_KINDS.has(child.kind) ? "dsui-transparent" : "dsui-item"
      }
      key={key}
    >
      {renderNode(client, child, context)}
    </div>
  ));
}
