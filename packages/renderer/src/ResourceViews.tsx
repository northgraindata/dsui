import type { PageNode, TableRowAction } from "@northgraindata/dsui-core";
import {
  Button,
  DataTable,
  KeyValueList,
  Surface,
} from "@northgraindata/dsui-ui";
import { useCallback, useEffect, useState } from "react";
import type { RendererClient } from "./types";

/** Fills :param placeholders from row fields; null when a field is missing. */
function resolveLink(
  path: string,
  params: Record<string, string>,
  row: Record<string, unknown>,
): string | null {
  let resolved = path;
  for (const [param, field] of Object.entries(params)) {
    const value = row[field];
    if (value === null || value === undefined) return null;
    resolved = resolved.replace(`:${param}`, encodeURIComponent(String(value)));
  }
  return resolved;
}

function matchesWhen(
  row: Record<string, unknown>,
  when: TableRowAction["when"],
): boolean {
  if (!when) return true;
  const value = row[when.field];
  if (when.equals !== undefined && value !== when.equals) return false;
  if (when.notEquals !== undefined && value === when.notEquals) return false;
  return true;
}

function RowActionButton({
  client,
  spec,
  row,
  onDone,
}: {
  client: RendererClient;
  spec: TableRowAction;
  row: Record<string, unknown>;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="small"
        variant={
          spec.variant === "primary" ? "default" : (spec.variant ?? "secondary")
        }
        disabled={busy}
        title={error}
        onClick={() => {
          const input: Record<string, unknown> = {};
          for (const [key, field] of Object.entries(spec.action.input ?? {})) {
            input[key] = row[field];
          }
          setBusy(true);
          setError(undefined);
          client
            .executeAction({ actionId: spec.action.actionId, input })
            .then((result) => {
              if (result.status === "success") onDone();
              else setError(result.message ?? "Action failed");
            })
            .catch((cause) =>
              setError(
                cause instanceof Error ? cause.message : "Action failed",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        {spec.label}
      </Button>
      {error ? (
        <span className="text-[10px] text-unavailable">{error}</span>
      ) : null}
    </span>
  );
}

export function ResourceTable({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "table" }>;
}) {
  const [data, setData] = useState<unknown>(node.props.data);
  const [error, setError] = useState<string>();
  const [_refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((count) => count + 1), []);
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
  const rowLink = node.props.rowLink;
  const rowActions = node.props.rowActions;
  return (
    <DataTable
      columns={
        node.props.columns ??
        Object.keys(rows[0]).map((id) => ({ id, label: id }))
      }
      rows={rows}
      onRowClick={
        rowLink
          ? (row) => {
              const href = resolveLink(rowLink.path, rowLink.params, row);
              if (href) client.navigate(href);
            }
          : undefined
      }
      renderRowActions={
        rowActions?.length
          ? (row) => (
              <>
                {rowActions
                  .filter((spec) => matchesWhen(row, spec.when))
                  .map((spec) => (
                    <RowActionButton
                      key={`${spec.label}:${spec.action.actionId}`}
                      client={client}
                      spec={spec}
                      row={row}
                      onDone={reload}
                    />
                  ))}
              </>
            )
          : undefined
      }
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
