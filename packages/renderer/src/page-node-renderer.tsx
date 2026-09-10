import type { PageNode } from "@northgraindata/dsui-core";
import { Surface } from "@northgraindata/dsui-ui";
import { CustomView } from "./components/custom";
import { EntityCatalogView, EntityDetailView } from "./EntityViews";
import {
  ActionListView,
  CardListView,
  ColumnsView,
  MeterView,
  SectionView,
  StatGridView,
} from "./OverviewViews";
import { type RegistryViewProps, registerView, resolveView } from "./registry";
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

function registerFirstPartyViews(): void {
  registerView("entity-catalog", ({ client, node }: RegistryViewProps) =>
    node.kind === "entity-catalog" ? (
      <EntityCatalogView client={client} node={node} />
    ) : null,
  );
  registerView("entity-detail", ({ client, node }: RegistryViewProps) =>
    node.kind === "entity-detail" ? (
      <EntityDetailView client={client} node={node} />
    ) : null,
  );
  registerView("stat-grid", ({ client, node }: RegistryViewProps) =>
    node.kind === "stat-grid" ? (
      <StatGridView client={client} node={node} />
    ) : null,
  );
  registerView("section", ({ client, node, renderNode }: RegistryViewProps) =>
    node.kind === "section" ? (
      <SectionView client={client} node={node} renderNode={renderNode} />
    ) : null,
  );
  registerView("card-list", ({ client, node }: RegistryViewProps) =>
    node.kind === "card-list" ? (
      <CardListView client={client} node={node} />
    ) : null,
  );
  registerView("action-list", ({ client, node }: RegistryViewProps) =>
    node.kind === "action-list" ? (
      <ActionListView client={client} node={node} />
    ) : null,
  );
  registerView("columns", ({ client, node, renderNode }: RegistryViewProps) =>
    node.kind === "columns" ? (
      <ColumnsView client={client} node={node} renderNode={renderNode} />
    ) : null,
  );
  registerView("meter", ({ client, node }: RegistryViewProps) =>
    node.kind === "meter" ? <MeterView client={client} node={node} /> : null,
  );
}

registerFirstPartyViews();

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
