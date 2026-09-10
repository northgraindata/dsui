import { useMemo } from "react";
import type { DeclarativePageRendererProps } from "../types/renderer-types";
import { PageNodeRenderer } from "./page-node-renderer";

export function DeclarativePageRenderer({
  client,
  nodes,
}: DeclarativePageRendererProps) {
  const content = useMemo(
    () =>
      nodes.map((node) => (
        <PageNodeRenderer
          key={JSON.stringify(node)}
          client={client}
          node={node}
        />
      )),
    [client, nodes],
  );
  return <div className="grid gap-4">{content}</div>;
}
