import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { RegistryViewProps } from "../../registry/view-registry";

function nodes(value: PageNode | readonly PageNode[]): readonly PageNode[] {
  return "kind" in value ? [value] : value;
}

export function FlexView({ client, node, renderNode, context }: RegistryViewProps) {
  if (node.kind !== "flex") return null;
  return (
    <div
      className="layout-flex"
      data-direction={node.props.direction ?? "row"}
      data-gap={node.props.gap ?? "md"}
      data-align={node.props.align ?? "stretch"}
      data-justify={node.props.justify ?? "start"}
      data-wrap={node.props.wrap ? "true" : "false"}
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
