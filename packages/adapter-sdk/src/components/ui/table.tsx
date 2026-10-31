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
import { LiveDuration } from "./live-duration";
import { LiveEta, LiveProgress } from "./live-progress";
import {
  isRowActionDisabled,
  matchesWhen,
  performRowAction,
  resolveLink,
} from "./row-action";
import { TableExplorer } from "./table-explorer";

export {
  actionId,
  isRowActionDisabled,
  matchesWhen,
  resolveLink,
} from "./row-action";

type TableNodeProps = TableProps & { component?: string };

/** Browser implementation of the reusable SDK table component. */
export function Table({ client, node, renderNode }: ComponentProps) {
  const props = readProps(node);
  const [data, setData] = useState<unknown>(props?.data);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);

  useEffect(() => {
    void refresh;
    if (!props?.source) return;
    if (props.source.refresh?.kind === "poll" && client.watchResource) {
      return client.watchResource(props.source, (result) => setData(result));
    }
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
  const rowLink = props.rowLink;
  const rowActions = props.rowActions;
  const actions = props.actions;

  return (
    <TableExplorer
      columns={columns}
      rows={rows}
      filters={props.filters}
      insights={props.variant === "data"}
      renderTable={(visibleRows, renderHeader) => (
        <DataTable
          columns={columns}
          rows={visibleRows}
          renderHeader={renderHeader}
          renderCell={(columnId, value, row) => {
            const column = columns.find(
              (candidate) => candidate.id === columnId,
            );
            if (column?.format === "duration")
              return (
                <LiveDuration
                  startedAt={row.queryStart}
                  active={row.state === "active"}
                />
              );
            if (column?.format === "eta")
              return <LiveEta etaSeconds={row.etaSeconds} />;
            if (column?.format === "progress")
              return (
                <LiveProgress
                  active={row.state === "active"}
                  percent={row.progressPercent}
                />
              );
            if (!column?.renderCell) return formatCell(value);
            const cells = Array.isArray(column.renderCell)
              ? column.renderCell
              : [column.renderCell];
            return cells.map((cell) => (
              <span key={JSON.stringify(cell)}>
                {renderNode(client, cell, row) as ReactNode}
              </span>
            ));
          }}
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
              ? (row) =>
                  rowActions.map((spec) => (
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
            actions?.length
              ? (row) =>
                  actions.map((spec) => (
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
      )}
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
  const [actionError, setActionError] = useState<string>();
  const enabled = matchesWhen(row, spec.when);
  const disabled = isRowActionDisabled(row, spec.disabledWhen);
  return (
    <>
      <button
        type="button"
        title={actionError}
        disabled={busy || disabled || !enabled || (!spec.action && !spec.link)}
        onClick={() => {
          if (
            spec.confirmation &&
            !window.confirm(
              `${spec.confirmation.title}\n\n${spec.confirmation.description}`,
            )
          )
            return;
          setBusy(true);
          setActionError(undefined);
          void performRowAction(client, spec, row, onDone)
            .then(setActionError)
            .finally(() => setBusy(false));
        }}
      >
        {spec.icon ? <WorkbenchIcon name={spec.icon} size={14} /> : null}
        {spec.label}
      </button>
      {actionError ? <span role="alert">{actionError}</span> : null}
    </>
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
  const [actionError, setActionError] = useState<string>();
  const enabled = matchesWhen(row, spec.when);
  return (
    <>
      <button
        type="button"
        title={actionError}
        disabled={busy || !enabled}
        onClick={() => {
          if (
            spec.confirmation &&
            !window.confirm(spec.confirmation.description)
          )
            return;
          setBusy(true);
          setActionError(undefined);
          void performRowAction(client, spec, row)
            .then(setActionError)
            .finally(() => setBusy(false));
        }}
      >
        {spec.label}
      </button>
      {actionError ? <span role="alert">{actionError}</span> : null}
    </>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
