import type { CSSProperties } from "react";
import type { ComponentProps as RegistryViewProps } from "../../runtime";
import { LayoutItems } from "./layout-items";

export function Grid({ node, ...host }: RegistryViewProps) {
  if (node.kind !== "grid") return null;
  const columns = node.props.columns;
  const style = columns
    ? ({ "--dsui-grid-columns": columns } as CSSProperties)
    : undefined;

  return (
    <div
      className="dsui-grid"
      data-gap={node.props.gap ?? "md"}
      data-min-column={node.props.minColumnWidth ?? "md"}
      data-columns={columns}
      style={style}
    >
      <LayoutItems {...host} content={node.props.content} />
    </div>
  );
}

export default Grid;
