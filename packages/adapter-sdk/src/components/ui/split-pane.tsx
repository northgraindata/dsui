import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import { Fragment, useState } from "react";
import type { ComponentProps as RegistryViewProps } from "../runtime";
import { positioned } from "./keys";

export default function SplitPane({
  client,
  node,
  renderNode,
  context,
}: RegistryViewProps) {
  const [open, setOpen] = useState(true);
  if (node.kind !== "split-pane") return null;
  // Panes render their nodes unwrapped so headers and trees can fill them.
  const pane = (nodes: PageNode | readonly PageNode[]) =>
    positioned("kind" in nodes ? [nodes] : nodes).map(({ item, key }) => (
      <Fragment key={key}>{renderNode(client, item, context)}</Fragment>
    ));
  return (
    <section
      className={`dsui-split ${node.props.inspector?.length ? "dsui-split--inspector" : ""}`}
    >
      <div className="border-b border-border bg-surface @min-[600px]/dsui-page:hidden">
        <button
          type="button"
          className="flex h-10 w-full items-center justify-between px-3 font-mono text-[11px] uppercase tracking-wide text-secondary"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {node.props.sidebarLabel ?? "Data explorer"}
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
      </div>
      <aside
        className={`dsui-split-sidebar ${open ? "block" : "hidden"} @min-[600px]/dsui-page:block`}
        data-dsui-scroll=""
      >
        {pane(node.props.sidebar)}
      </aside>
      <div className="dsui-split-content" data-dsui-scroll="">
        {pane(node.props.content)}
      </div>
      {node.props.inspector?.length ? (
        <aside className="dsui-split-inspector" aria-label="Object details">
          {pane(node.props.inspector)}
        </aside>
      ) : null}
    </section>
  );
}
