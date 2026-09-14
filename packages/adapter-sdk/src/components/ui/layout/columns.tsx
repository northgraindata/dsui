import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { CSSProperties, ReactNode } from "react";
import type { ComponentClient } from "../../runtime";

type RenderNode = (
  client: ComponentClient,
  node: PageNode,
  context?: Record<string, unknown>,
) => ReactNode;

export function Columns({
  client,
  node,
  renderNode,
  context,
}: {
  client: ComponentClient;
  node: PageNode;
  renderNode: RenderNode;
  context?: Record<string, unknown>;
}) {
  return (
    <div
      className="ov-columns"
      style={
        {
          "--ov-cols": node.props.columns
            .map((column: any) => `${column.weight ?? 1}fr`)
            .join(" "),
        } as CSSProperties
      }
    >
      {node.props.columns.map((column: any, index: number) => {
        const content = Array.isArray(column.content)
          ? column.content
          : [column.content];
        return (
          // Column order is adapter-declared and stable for the page lifetime.
          // biome-ignore lint/suspicious/noArrayIndexKey: static adapter-declared column order
          <div className="ov-column" key={`column-${index}`}>
            {content.map((child: any) => renderNode(client, child, context))}
          </div>
        );
      })}
    </div>
  );
}

export default Columns;
