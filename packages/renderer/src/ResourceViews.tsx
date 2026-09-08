import type { PageNode } from "@northgraindata/dsui-core";
import { DataTable, KeyValueList, Surface } from "@northgraindata/dsui-ui";
import { useEffect, useState } from "react";
import type { RendererClient } from "./types";

export function ResourceTable({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "table" }>;
}) {
  const [data, setData] = useState<unknown>(node.props.data);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!node.props.source) return;
    let active = true;
    client
      .executeResource(node.props.source)
      .then((result) => active && setData(result))
      .catch(
        (cause) =>
          active &&
          setError(
            cause instanceof Error ? cause.message : "Could not load records",
          ),
      );
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
        Loading records…
      </Surface>
    );
  const rows = Array.isArray(data)
    ? data.map((row) =>
        row && typeof row === "object" && !Array.isArray(row)
          ? (row as Record<string, unknown>)
          : { value: row },
      )
    : [];
  if (!rows.length)
    return (
      <Surface className="p-5 text-[12px] text-secondary">No records.</Surface>
    );
  return (
    <DataTable
      columns={
        node.props.columns ??
        Object.keys(rows[0]).map((id) => ({ id, label: id }))
      }
      rows={rows}
    />
  );
}

export function ResourceKeyValue({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "key-value" }>;
}) {
  const [data, setData] = useState<Record<string, unknown> | undefined>(
    node.props.data,
  );
  useEffect(() => {
    if (!node.props.source) return;
    let active = true;
    client.executeResource(node.props.source).then((result) => {
      if (
        active &&
        result &&
        typeof result === "object" &&
        !Array.isArray(result)
      )
        setData(result as Record<string, unknown>);
    });
    return () => {
      active = false;
    };
  }, [client, node.props.source]);
  return data ? (
    <KeyValueList title={node.props.title} values={data} />
  ) : (
    <Surface className="p-4 text-[12px] text-secondary">
      Loading details…
    </Surface>
  );
}
