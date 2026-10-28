import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import { Surface } from "@northgraindata/dsui-ui";
import { useEffect, useState } from "react";
import type { CollectionNode } from "../primitives/collection";
import type { ComponentProps as RegistryViewProps } from "../runtime";
import { keyedItems } from "./keyed-items";

function nodes(value: PageNode | readonly PageNode[]): readonly PageNode[] {
  return "kind" in value ? [value] : value;
}

export default function Collection(props: RegistryViewProps) {
  if (props.node.kind !== "collection") return null;
  return (
    <CollectionContent
      {...props}
      node={{ kind: "collection", props: props.node.props }}
    />
  );
}

function CollectionContent({
  client,
  node,
  renderNode,
  context,
}: RegistryViewProps & {
  node: CollectionNode;
}) {
  const [rows, setRows] = useState<readonly Record<string, unknown>[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    const resultPromise = node.props.source
      ? client.executeResource(node.props.source)
      : Promise.resolve(resolve(context, node.props.field));
    resultPromise
      .then((result) => {
        if (!active) return;
        if (result === undefined || result === null) setRows([]);
        else if (Array.isArray(result))
          setRows(
            result.map((item) => (isRecord(item) ? item : { value: item })),
          );
        else setError("Could not load collection");
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load collection",
          );
      });
    return () => {
      active = false;
    };
  }, [client, context, node.props.field, node.props.source]);
  if (error)
    return (
      <Surface className="p-4 text-[12px] text-unavailable" role="alert">
        {error}
      </Surface>
    );
  if (!rows)
    return (
      <Surface className="p-5 text-[12px] text-secondary" aria-busy="true">
        Loading items…
      </Surface>
    );
  if (!rows.length) return null;
  return (
    <div className="layout-collection">
      {keyedItems(rows).map(({ item: row, key: rowKey }) =>
        keyedItems(nodes(node.props.content)).map(({ item: child, key }) => (
          <div
            className="layout-collection-item"
            key={JSON.stringify([rowKey, key])}
          >
            {renderNode(client, child, row)}
          </div>
        )),
      )}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolve(
  context: Record<string, unknown> | undefined,
  field: string | undefined,
): unknown {
  if (!field) return undefined;
  return field.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object")
      return (current as Record<string, unknown>)[key];
    return undefined;
  }, context);
}
