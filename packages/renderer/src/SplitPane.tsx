import type { PageNode } from "@northgraindata/dsui-core";
import type { ReactNode } from "react";
import { useState } from "react";
import type { RendererClient } from "./types";

export function SplitPaneView({
  client,
  node,
  renderNode,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "split-pane" }>;
  renderNode(client: RendererClient, node: PageNode): ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="grid min-h-[42rem] overflow-hidden border border-border bg-canvas md:grid-cols-[17rem_minmax(0,1fr)]">
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
        className={`${open ? "block" : "hidden"} max-h-80 overflow-auto border-b border-border md:block md:max-h-none md:border-r md:border-b-0`}
      >
        {node.props.sidebar.map((child) => renderNode(client, child))}
      </aside>
      <div className="min-w-0 space-y-5 overflow-auto p-4 md:p-5">
        {node.props.content.map((child) => renderNode(client, child))}
      </div>
    </section>
  );
}
