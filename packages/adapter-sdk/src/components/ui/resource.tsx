import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import { Surface } from "@northgraindata/dsui-ui";
import { Fragment, useEffect, useState } from "react";
import type { ResourceNode } from "../primitives/resource";
import type { ComponentProps as RegistryViewProps } from "../runtime";
import { keyedItems } from "./keyed-items";

function nodes(value: PageNode | readonly PageNode[]): readonly PageNode[] {
  return "kind" in value ? [value] : value;
}

export default function Resource(props: RegistryViewProps) {
  if (props.node.kind !== "resource") return null;
  return (
    <ResourceContent
      {...props}
      node={{ kind: "resource", props: props.node.props }}
    />
  );
}

function ResourceContent({
  client,
  node,
  renderNode,
}: RegistryViewProps & {
  node: ResourceNode;
}) {
  const [data, setData] = useState<Record<string, unknown>>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    client
      .executeResource(node.props.source)
      .then((result) => {
        if (!active) return;
        if (result && typeof result === "object" && !Array.isArray(result))
          setData(result as Record<string, unknown>);
        else setError("Could not load resource");
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load resource",
          );
      });
    return () => {
      active = false;
    };
  }, [client, node.props.source]);
  if (error)
    return (
      <Surface className="p-4 text-[12px] text-unavailable" role="alert">
        {error}
      </Surface>
    );
  if (!data)
    return (
      <Surface className="p-5 text-[12px] text-secondary" aria-busy="true">
        Loading…
      </Surface>
    );
  return (
    <>
      {keyedItems(nodes(node.props.content)).map(({ item: child, key }) => (
        <Fragment key={key}>{renderNode(client, child, data)}</Fragment>
      ))}
    </>
  );
}
