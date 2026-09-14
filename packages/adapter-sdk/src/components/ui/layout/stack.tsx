import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { ComponentProps as RegistryViewProps } from "../../runtime";

function nodes(value: PageNode | readonly PageNode[]): readonly PageNode[] {
  return "kind" in value ? [value] : value;
}

export function Stack({
  client,
  node,
  renderNode,
  context,
}: RegistryViewProps) {
  if (node.kind !== "stack") return null;
  return (
    <div className="layout-stack" data-gap={node.props.gap ?? "md"}>
      {nodes(node.props.content).map((child, index) => (
        <div key={`${child.kind}-${index}`}>
          {renderNode(client, child, context)}
        </div>
      ))}
    </div>
  );
}

export default Stack;
