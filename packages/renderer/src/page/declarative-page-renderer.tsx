import type { PageNode } from "@northgraindata/dsui-core";
import { useMemo } from "react";
import type { DeclarativePageRendererProps } from "../types/renderer-types";
import { PageNodeRenderer } from "./page-node-renderer";

export function DeclarativePageRenderer({
  client,
  nodes,
}: DeclarativePageRendererProps) {
  const content = useMemo(() => {
    const elements: React.ReactNode[] = [];
    let currentButtons: Extract<PageNode, { kind: "button" }>[] = [];

    const flushButtons = () => {
      if (!currentButtons.length) return;
      const group = currentButtons;
      currentButtons = [];
      elements.push(
        <div
          key={`buttons-${elements.length}`}
          className="flex flex-wrap items-center gap-2"
        >
          {group.map((buttonNode) => (
            <PageNodeRenderer
              key={`${buttonNode.props.label}:${buttonNode.props.action?.actionId ?? "action"}`}
              client={client}
              node={buttonNode}
            />
          ))}
        </div>,
      );
    };

    for (const node of nodes) {
      if (node.kind === "button") {
        currentButtons.push(node);
      } else {
        flushButtons();
        elements.push(
          <PageNodeRenderer
            key={JSON.stringify(node)}
            client={client}
            node={node}
          />,
        );
      }
    }
    flushButtons();
    return elements;
  }, [client, nodes]);

  return <div className="grid gap-4">{content}</div>;
}
