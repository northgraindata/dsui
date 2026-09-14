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
  const [ExternalComponent, setExternalComponent] =
    useState<ComponentType<ComponentProps> | null>(null);
  useEffect(() => {
    if (entry) return;
    let active = true;
    void loadExternalComponent(
      node.props.component,
      node.props.browserUrl,
    ).then((component) => {
      if (active) setExternalComponent(component);
    });
    return () => {
      active = false;
    };
  }, [entry, node.props.component, node.props.browserUrl]);
  const Component = entry?.component ?? ExternalComponent;
  if (!Component)
    return (
      <Surface className="p-4 text-[12px] text-unavailable" role="alert">
        Unknown component “{node.props.component}”. The adapter declaring it is
        not installed or its browser path is not available in this build.
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
