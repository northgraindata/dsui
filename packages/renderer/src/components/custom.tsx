import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import { Surface } from "@northgraindata/dsui-ui";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import {
  type ComponentProps,
  resolveComponent,
} from "../registry/component-registry";
import { loadExternalComponent } from "../registry/external-components";

/**
 * Renders a `"custom"` node through discovered browser components. Unknown
 * components render an explicit fallback instead of failing silently or blank.
 */
export function Custom({
  client,
  node,
  renderNode,
  context,
}: {
  client: ComponentProps["client"];
  node: PageNode;
  renderNode: ComponentProps["renderNode"];
  context?: Record<string, unknown>;
}) {
  const entry = resolveComponent(node.props.component, node.props.path);
  const key = `${node.props.component}:${node.props.browserUrl ?? ""}`;
  const [external, setExternal] = useState<{
    key: string;
    component: ComponentType<ComponentProps> | null;
  }>();
  useEffect(() => {
    if (entry) return;
    let active = true;
    void loadExternalComponent(
      node.props.component,
      node.props.browserUrl,
    ).then((component) => {
      if (active) setExternal({ key, component });
    });
    return () => {
      active = false;
    };
  }, [entry, key, node.props.component, node.props.browserUrl]);
  const Component =
    entry?.component ?? (external?.key === key ? external.component : null);
  if (!entry && external?.key !== key)
    return <span role="status">Loading extension…</span>;
  if (!Component)
    return (
      <Surface className="p-4 text-[12px] text-unavailable" role="alert">
        Unknown component “{node.props.component}”. Its browser bundle is not
        available in this build.
      </Surface>
    );
  return (
    <Component
      client={client}
      node={node}
      context={context}
      renderNode={renderNode}
    />
  );
}
