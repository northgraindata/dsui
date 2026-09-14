import type { PageNode, TabsItem } from "@northgraindata/dsui-adapter-sdk";
import { useState } from "react";
import type { ComponentProps as RegistryViewProps } from "../runtime";

export default function Tabs({
  client,
  node,
  renderNode,
  context,
}: RegistryViewProps) {
  const [selected, setSelected] = useState(
    node.kind === "tabs" ? (node.props.defaultIndex ?? 0) : 0,
  );
  if (node.kind !== "tabs") return null;
  const item = node.props.items[selected];
  const content: readonly PageNode[] = item
    ? "kind" in item.content
      ? [item.content]
      : item.content
    : [];
  return (
    <div
      className="workspace-tabs"
      data-variant={node.props.variant ?? "default"}
    >
      <div role="tablist" className="mb-4 flex gap-1 border-b border-border">
        {node.props.items.map((tab: TabsItem, index: number) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={selected === index}
            className="px-3 py-2 text-[11px] text-secondary aria-selected:text-primary"
            onClick={() => {
              if (tab.link) client.navigate(tab.link);
              else setSelected(index);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4">
        {content.map((child: PageNode) => renderNode(client, child, context))}
      </div>
    </div>
  );
}
