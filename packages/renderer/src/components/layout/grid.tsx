import type { CSSProperties } from "react";
import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { RegistryViewProps } from "../../registry/view-registry";

function nodes(value: PageNode | readonly PageNode[]): readonly PageNode[] {
  return "kind" in value ? [value] : value;
}

export function GridView({ client, node, renderNode, context }: RegistryViewProps) {
  if (node.kind !== "grid") return null;
  const columns = node.props.columns;
  const style: CSSProperties | undefined = columns
    ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
    : undefined;

  return (
    <div
      className="layout-grid"
      data-gap={node.props.gap ?? "md"}
      style={style}
    >
      {nodes(node.props.content).map((child, index) => (
        <div
          className={child.kind === "collection" ? "layout-transparent" : undefined}
          key={`${child.kind}-${index}`}
        >
          {renderNode(client, child, context)}
        </div>
      ))}
    </div>
  );
}
