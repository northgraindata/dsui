import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { ComponentProps as RegistryViewProps } from "../../runtime";
import { keyedItems } from "../keyed-items";

function nodes(value: PageNode | readonly PageNode[]): readonly PageNode[] {
  return "kind" in value ? [value] : value;
}

export function Flex({ client, node, renderNode, context }: RegistryViewProps) {
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
      {keyedItems(nodes(node.props.content)).map(({ item: child, key }) => (
        <div
          className={
            child.kind === "collection" ? "layout-transparent" : undefined
          }
          key={key}
        >
          {renderNode(client, child, context)}
        </div>
      ))}
    </div>
  );
}

export default Flex;
