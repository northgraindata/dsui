import type { PageNode } from "@northgraindata/dsui-core";
import { Surface } from "@northgraindata/dsui-ui";
import { CustomView } from "./components/custom";
import { resolveView } from "./registry";
import type { RendererClient } from "./types";
import "./components/button";
import "./components/form";
import "./components/key-value";
import "./components/page-header";
import "./components/query-workbench/query-workbench";
import "./components/resource-tree";
import "./components/select";
import "./components/split-pane";
import "./components/table";
import "./components/tabs";
import "./components/text-input";

/**
 * Renders a page node through the component registry. `"custom"` nodes
 * resolve their component id lazily; every other kind resolves a
 * first-party view. Unknown kinds render an explicit fallback.
 */
export function PageNodeRenderer({
  client,
  node,
}: {
  client: RendererClient;
  node: PageNode;
}) {
  if (node.kind === "custom")
    return (
      <CustomView
        client={client}
        node={node}
        renderNode={(nextClient, child) => (
          <PageNodeRenderer
            key={JSON.stringify(child)}
            client={nextClient}
            node={child}
          />
        )}
      />
    );
  const entry = resolveView(node.kind);
  if (entry?.type !== "sync")
    return (
      <Surface className="p-4 text-[12px] text-unavailable" role="alert">
        Unknown component “{node.kind}”.
      </Surface>
    );
  const View = entry.view;
  return (
    <View
      client={client}
      node={node}
      renderNode={(nextClient, child) => (
        <PageNodeRenderer
          key={JSON.stringify(child)}
          client={nextClient}
          node={child}
        />
      )}
    />
  );
}
