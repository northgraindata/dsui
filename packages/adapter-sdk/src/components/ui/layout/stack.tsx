import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { ComponentProps as RegistryViewProps } from "../../runtime";
import { keyedItems } from "../keyed-items";

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
      {keyedItems(nodes(node.props.content)).map(({ item: child, key }) => (
        <div key={key}>{renderNode(client, child, context)}</div>
      ))}
    </div>
  );
}

export default Stack;
