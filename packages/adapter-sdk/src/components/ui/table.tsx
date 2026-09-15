import { DataTable } from "@northgraindata/dsui-ui";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import type { PageNode } from "../nodes";
import type {
  TableColumn,
  TableProps,
  TableRowAction,
  TableRowMenuAction,
} from "../primitives/table";
import type { ComponentProps } from "../runtime";
import { WorkbenchIcon } from "./icons";

type TableNodeProps = TableProps & { component?: string };

/** Browser implementation of the reusable SDK table component. */
export function Table({ client, node, renderNode }: ComponentProps) {
  const props = readProps(node);
  const [data, setData] = useState<unknown>(props?.data);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);

  useEffect(() => {
    if (!props?.source) return;
    let active = true;
    setError(undefined);
    client
      .executeResource(props.source)
      .then((result) => active && setData(result))
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load records",
          );
      });
    return () => {
      active = false;
    };
  }, [client, props?.source, refresh]);

  if (!props) return null;
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p aria-busy="true">Loading records…</p>;

  const rows = normalizeRows(data);
  if (!rows.length) return <p>No records.</p>;
  const columns: readonly TableColumn[] =
    props.columns ?? Object.keys(rows[0]).map((id) => ({ id, label: id }));

  return (
    <DataTable
      columns={columns}
      rows={rows}
      renderCell={(columnId, value, row) => {
        const column = columns.find((candidate) => candidate.id === columnId);
        if (!column?.renderCell) return formatCell(value);
        const cells = Array.isArray(column.renderCell)
          ? column.renderCell
          : [column.renderCell];
        return cells.map((cell, index) => (
          <span key={`${cell.kind}-${index}`}>
            {renderNode(client, cell, row) as ReactNode}
          </span>
        ));
      }}
      onRowClick={
        props.rowLink
          ? (row) => {
              const href = resolveLink(
                props.rowLink!.path,
                props.rowLink!.params,
                row,
              );
              if (href) client.navigate(href);
            }
          : undefined
      }
      renderRowActions={
        props.rowActions?.length
          ? (row) =>
              props.rowActions!.map((spec) => (
                <RowAction
                  key={`${spec.label}:${spec.action ?? spec.link?.path ?? ""}`}
                  client={client}
                  row={row}
                  spec={spec}
                  onDone={reload}
                />
              ))
          : undefined
      }
      renderRowMenu={
        props.actions?.length
          ? (row) =>
              props.actions!.map((spec) => (
                <RowMenuAction
                  key={`${spec.label}:${spec.action ?? spec.link?.path ?? ""}`}
                  client={client}
                  row={row}
                  spec={spec}
                />
              ))
          : undefined
      }
    />
  );
}

export default Table;

function readProps(node: PageNode): TableNodeProps | undefined {
  if (node.kind !== "custom") return undefined;
  const props = node.props.props;
  return props && typeof props === "object" ? (props as TableNodeProps) : {};
}

function normalizeRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map((row) =>
        row && typeof row === "object" && !Array.isArray(row)
          ? (row as Record<string, unknown>)
          : { value: row },
      )
    : [];
}

export function resolveLink(
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

function RowAction({
  client,
  row,
  spec,
  onDone,
}: {
  client: ComponentProps["client"];
  row: Record<string, unknown>;
  spec: TableRowAction;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const enabled = matchesWhen(row, spec.when);
  const disabled = !matchesWhen(row, spec.disabledWhen);
  return (
    <button
      type="button"
      disabled={busy || disabled || !enabled || (!spec.action && !spec.link)}
      onClick={() => {
        if (
          spec.confirmation &&
          !window.confirm(
            `${spec.confirmation.title}\n\n${spec.confirmation.description}`,
          )
        )
          return;
        if (spec.link) {
          const href = resolveLink(spec.link.path, spec.link.params, row);
          if (href) client.navigate(href);
          return;
        }
        if (!spec.action) return;
        const input = Object.fromEntries(
          Object.entries(spec.input ?? {}).map(([key, field]) => [
            key,
            row[field],
          ]),
        );
        setBusy(true);
        client
          .executeAction({ actionId: actionId(spec.action), input })
          .then((result) => {
            if (result.status !== "success") return;
            onDone();
            if (spec.successLink) {
              const resultData =
                result.data && typeof result.data === "object"
                  ? (result.data as Record<string, unknown>)
                  : {};
              const href = resolveLink(
                spec.successLink.path,
                spec.successLink.params,
                { ...row, ...resultData },
              );
              if (href) client.navigate(href);
            }
          })
          .finally(() => setBusy(false));
      }}
    >
      {spec.icon ? <WorkbenchIcon name={spec.icon} size={14} /> : null}
      {spec.label}
    </button>
  );
}

function RowMenuAction({
  client,
  row,
  spec,
}: {
  client: ComponentProps["client"];
  row: Record<string, unknown>;
  spec: TableRowMenuAction;
}) {
  const [busy, setBusy] = useState(false);
  const enabled = matchesWhen(row, spec.when);
  return (
    <button
      type="button"
      disabled={busy || !enabled}
      onClick={() => {
        if (spec.confirmation && !window.confirm(spec.confirmation.description))
          return;
        if (spec.link) {
          const href = resolveLink(spec.link.path, spec.link.params, row);
          if (href) client.navigate(href);
          return;
        }
        if (!spec.action) return;
        const input = Object.fromEntries(
          Object.entries(spec.input ?? {}).map(([key, field]) => [
            key,
            row[field],
          ]),
        );
        setBusy(true);
        client
          .executeAction({ actionId: actionId(spec.action), input })
          .finally(() => setBusy(false));
      }}
    >
      {spec.label}
    </button>
  );
}

function matchesWhen(
  row: Record<string, unknown>,
  when: TableRowAction["when"] | TableRowAction["disabledWhen"],
): boolean {
  if (!when) return true;
  const value = row[when.field];
  if (when.equals !== undefined && value !== when.equals) return false;
  if (when.notEquals !== undefined && value === when.notEquals) return false;
  return true;
}

function actionId(
  action: TableRowAction["action"] | TableRowMenuAction["action"],
): string {
  if (!action) throw new Error("Table action is missing");
  return typeof action === "string" ? action : action.id;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
