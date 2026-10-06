import type { PageNode, ResourceProps } from "@northgraindata/dsui-adapter-sdk";
import { Surface } from "@northgraindata/dsui-ui";
import { Fragment, useEffect, useState } from "react";
import type { ComponentClient, ComponentProps } from "../runtime";

function nodes(value: PageNode | readonly PageNode[]): readonly PageNode[] {
  return "kind" in value ? [value] : value;
}

export default function Resource(props: ComponentProps) {
  if (props.node.kind !== "resource") return null;
  return (
    <ResourceContent
      client={props.client}
      resource={props.node.props}
      renderNode={props.renderNode}
    />
  );
}

function ResourceContent({
  client,
  resource,
  renderNode,
}: {
  client: ComponentClient;
  resource: ResourceProps;
  renderNode: ComponentProps["renderNode"];
}) {
  const [data, setData] = useState<Record<string, unknown>>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const accept = (result: unknown) => {
      if (result && typeof result === "object" && !Array.isArray(result)) {
        setData(result as Record<string, unknown>);
        setError(undefined);
      } else {
        setData(undefined);
        setError("Could not load resource");
      }
    };
    if (resource.source.refresh?.kind === "poll" && client.watchResource) {
      return client.watchResource(resource.source, accept);
    }
    let active = true;
    client
      .executeResource(resource.source)
      .then((result) => active && accept(result))
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load resource",
          );
      });
    return () => {
      active = false;
    };
  }, [client, resource.source]);
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
      {nodes(resource.content).map((child) => (
        <Fragment key={`${child.kind}-${JSON.stringify(child.props)}`}>
          {renderNode(client, child, data)}
        </Fragment>
      ))}
    </>
  );
}
