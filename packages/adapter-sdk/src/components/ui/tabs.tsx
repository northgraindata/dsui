import type { PageNode, TabsItem } from "@northgraindata/dsui-adapter-sdk";
import { Fragment } from "react";
import type { ComponentProps as RegistryViewProps } from "../runtime";
import { positioned } from "./keys";
import { usePropState } from "./use-prop-state";

export default function Tabs({
  client,
  node,
  renderNode,
  context,
}: RegistryViewProps) {
  // Linked tabs are chosen by the route, which arrives as a new default.
  const [selected, setSelected] = usePropState<number>(
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
      className="dsui-workspace-tabs"
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
      {/* Keyed by tab so panels never inherit each other's state. */}
      <div
        className="grid grid-cols-[minmax(0,1fr)] gap-component"
        key={selected}
      >
        {positioned(content).map(({ item: child, key }) => (
          <Fragment key={key}>{renderNode(client, child, context)}</Fragment>
        ))}
      </div>
    </div>
  );
}
