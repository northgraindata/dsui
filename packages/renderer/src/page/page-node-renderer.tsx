import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import { Surface } from "@northgraindata/dsui-ui";
import { CustomView } from "../components/custom";
import { registerFirstPartyViews } from "../registry/first-party-registry";
import { resolveView } from "../registry/view-registry";
import type { RendererClient } from "../types/renderer-types";

registerFirstPartyViews();

/**
 * Renders a page node through the component registry. `"custom"` nodes
 * resolve their component id lazily; every other kind resolves a
 * first-party view. Unknown kinds render an explicit fallback.
 */
export function PageNodeRenderer({
  client,
  node,
  context,
}: {
  client: RendererClient;
  node: PageNode;
  context?: Record<string, unknown>;
}) {
  if (node.kind === "custom")
    return (
      <CustomView
        client={client}
        node={node}
        renderNode={(nextClient, child, childContext = context) => (
          <PageNodeRenderer
            key={JSON.stringify(child)}
            client={nextClient}
            node={child}
            context={childContext}
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
      context={context}
      renderNode={(nextClient, child, childContext = context) => (
        <PageNodeRenderer
          key={JSON.stringify(child)}
          client={nextClient}
          node={child}
          context={childContext}
        />
      )}
    />
  );
}
