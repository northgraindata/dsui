import type { PageNode } from "@northgraindata/dsui-core";
import { useState } from "react";
import { PageNodeRenderer } from "./PageNodeRenderer";
import type { RendererClient } from "./types";

export function Tabs({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "tabs" }>;
}) {
  const [selected, setSelected] = useState(0);
  const item = node.props.items[selected];
  return (
    <div className="workspace-tabs">
      <div role="tablist" className="mb-4 flex gap-1 border-b border-border">
        {node.props.items.map((tab, index) => (
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
        {item?.content.map((child) => (
          <PageNodeRenderer
            key={JSON.stringify(child)}
            client={client}
            node={child}
          />
        ))}
      </div>
    </div>
  );
}
