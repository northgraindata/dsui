import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import { Surface } from "@northgraindata/dsui-ui";
import { Custom } from "../components/custom";
import { resolveComponent } from "../registry/component-registry";
import type { RendererClient } from "../types/renderer-types";

/**
 * Renders a page node through the component registry. `"custom"` nodes
 * resolve their component id/path; every other kind resolves a discovered
 * component. Unknown kinds render an explicit fallback.
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
      <Custom
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
  const entry = resolveComponent(node.kind);
  if (entry?.type !== "sync")
    return (
      <Surface className="p-4 text-[12px] text-unavailable" role="alert">
        Unknown component “{node.kind}”.
      </Surface>
    );
  const Component = entry.component;
  return (
    <Component
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
