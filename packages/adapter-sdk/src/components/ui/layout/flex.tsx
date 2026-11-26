import type { ComponentProps as RegistryViewProps } from "../../runtime";
import { LayoutItems } from "./layout-items";

export function Flex({ node, ...host }: RegistryViewProps) {
  if (node.kind !== "flex") return null;
  return (
    <div
      className="dsui-flex"
      data-direction={node.props.direction ?? "row"}
      data-gap={node.props.gap ?? "md"}
      data-align={node.props.align ?? "stretch"}
      data-justify={node.props.justify ?? "start"}
      data-wrap={node.props.wrap ? "true" : "false"}
    >
      <LayoutItems {...host} content={node.props.content} />
    </div>
  );
}

export default Flex;
