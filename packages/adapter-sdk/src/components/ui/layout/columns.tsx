import type { CSSProperties } from "react";
import type { ColumnsColumn } from "../../primitives/columns";
import type { ComponentProps as RegistryViewProps } from "../../runtime";
import { LayoutItems } from "./layout-items";

export function Columns({ node, ...host }: RegistryViewProps) {
  if (node.kind !== "columns") return null;
  const gap = node.props.gap ?? "md";
  const columns: readonly ColumnsColumn[] = node.props.columns;
  return (
    <div
      className="dsui-columns"
      data-gap={gap}
      style={
        {
          "--dsui-cols": columns
            .map((column) => `minmax(0, ${column.weight ?? 1}fr)`)
            .join(" "),
        } as CSSProperties
      }
    >
      {columns.map((column, index) => (
        // Column order is adapter-declared and stable for the page lifetime.
        // biome-ignore lint/suspicious/noArrayIndexKey: static adapter-declared column order
        <div className="dsui-column" data-gap={gap} key={`column-${index}`}>
          <LayoutItems {...host} content={column.content} />
        </div>
      ))}
    </div>
  );
}

export default Columns;
