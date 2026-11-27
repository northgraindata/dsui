import type { ComponentProps as RegistryViewProps } from "../../runtime";
import { LayoutItems } from "./layout-items";

export function Stack({ node, ...host }: RegistryViewProps) {
  if (node.kind !== "stack") return null;
  return (
    <div className="dsui-stack" data-gap={node.props.gap ?? "md"}>
      <LayoutItems {...host} content={node.props.content} />
    </div>
  );
}

export default Stack;
