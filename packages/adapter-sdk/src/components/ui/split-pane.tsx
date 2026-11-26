import { useState } from "react";
import type { ComponentProps as RegistryViewProps } from "../runtime";

export default function SplitPane({
  client,
  node,
  renderNode,
}: RegistryViewProps) {
  const [open, setOpen] = useState(true);
  if (node.kind !== "split-pane") return null;
  return (
    <section
      className={`dsui-split ${node.props.inspector?.length ? "dsui-split--inspector" : ""}`}
    >
      <div className="border-b border-border bg-surface md:hidden">
        <button
          type="button"
          className="flex h-10 w-full items-center justify-between px-3 font-mono text-[11px] uppercase tracking-wide text-secondary"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          Data explorer
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
      </div>
      <aside
        className={`dsui-split-sidebar ${open ? "block" : "hidden"} md:block`}
      >
        {node.props.sidebar.map((child: any) => renderNode(client, child))}
      </aside>
      <div className="dsui-split-content">
        {node.props.content.map((child: any) => renderNode(client, child))}
      </div>
      {node.props.inspector?.length ? (
        <aside className="dsui-split-inspector" aria-label="Object details">
          {node.props.inspector.map((child: any) => renderNode(client, child))}
        </aside>
      ) : null}
    </section>
  );
}
