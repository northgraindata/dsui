import { useState } from "react";
import type { RegistryViewProps } from "../registry/view-registry";

export function Tabs({ client, node, renderNode, context }: RegistryViewProps) {
  const [selected, setSelected] = useState(0);
  if (node.kind !== "tabs") return null;
  const item = node.props.items[selected];
  return (
    <div
      className="workspace-tabs"
      data-variant={node.props.variant ?? "default"}
    >
      <div role="tablist" className="mb-4 flex gap-1 border-b border-border">
        {node.props.items.map((tab: any, index: number) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={selected === index}
            className="px-3 py-2 text-[11px] text-secondary aria-selected:text-primary"
            onClick={() => setSelected(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4">
        {item?.content.map((child: any) => renderNode(client, child, context))}
      </div>
    </div>
  );
}
