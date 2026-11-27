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
import { formatTimestamp } from "./format-value";
import { WorkbenchIcon } from "./icons";
import { positioned } from "./keys";
import { LiveDuration } from "./live-duration";
import { LiveEta, LiveProgress } from "./live-progress";
import { PagedToolbar, Pager, usePagedSource } from "./paged";
import { useDisplayPreferences } from "./preferences";
import {
  isRowActionDisabled,
  matchesWhen,
  performRowAction,
  resolveLink,
} from "./row-action";
import { TableExplorer } from "./table-explorer";
import { useAction } from "./use-action";
import { usePropState } from "./use-prop-state";

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
  const [data, setData] = usePropState<unknown>(props?.data);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const reloadAll = useCallback(() => setRefresh((value) => value + 1), []);
  const paged = usePagedSource(
    client,
    props?.paged ? props.source : undefined,
    props?.paged,
  );

  const preferences = useDisplayPreferences();
  useEffect(() => {
    void refresh;
    if (!props?.source || props.paged) return;
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
  }, [client, props?.source, props?.paged, refresh]);

  if (!props) return null;
  const failure = props.paged ? (paged.page ? undefined : paged.error) : error;
  if (failure) return <p role="alert">{failure}</p>;
  if (props.paged ? !paged.page : !data)
    return <p aria-busy="true">Loading records…</p>;

  const rows = props.paged ? (paged.page?.items ?? []) : normalizeRows(data);
  // A narrowed page may be empty and must keep its filters on screen.
  if (!rows.length && !paged.narrowed) return <p>No records.</p>;
  const columns: readonly TableColumn[] =
    props.columns ??
    Object.keys(rows[0] ?? {}).map((id) => ({ id, label: id }));
  const reload = props.paged ? paged.reload : reloadAll;
  const rowLink = props.rowLink;
  const rowActions = props.rowActions;
  const actions = props.actions;

  const renderTable = (
    visibleRows: Record<string, unknown>[],
    renderHeader?: (column: TableColumn) => ReactNode,
  ) => (
    <DataTable
      columns={columns}
      rows={visibleRows}
      renderHeader={renderHeader}
      renderCell={(columnId, value, row) => {
        const column = columns.find((candidate) => candidate.id === columnId);
        if (column?.format === "duration")
          return (
            <LiveDuration
              startedAt={row.queryStart}
              active={row.state === "active"}
            />
          );
        if (column?.format === "datetime")
          return formatTimestamp(value, preferences);
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
        return positioned(cells).map(({ item: cell, key }) => (
          <span key={key}>{renderNode(client, cell, row) as ReactNode}</span>
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
  );

  // Sorting or filtering one page would silently ignore all the others.
  if (props.paged)
    return (
      <div className="dsui-paged" aria-busy={paged.loading}>
        <PagedToolbar paging={props.paged} paged={paged} />
        {rows.length ? (
          renderTable(rows)
        ) : (
          <p className="dsui-list-empty">No records match.</p>
        )}
        {paged.error ? <p role="alert">{paged.error}</p> : null}
        <Pager paged={paged} />
      </div>
    );

  return (
    <TableExplorer
      columns={columns}
      rows={rows}
      filters={props.filters}
      insights={props.variant === "data"}
      renderTable={renderTable}
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
  const { run, pending, failed, dialog } = useAction();
  const enabled = matchesWhen(row, spec.when);
  const disabled = isRowActionDisabled(row, spec.disabledWhen);
  return (
    <>
      <button
        type="button"
        aria-busy={pending}
        data-state={failed ? "error" : undefined}
        disabled={
          pending || disabled || !enabled || (!spec.action && !spec.link)
        }
        onClick={(event) => {
          event.stopPropagation();
          run({
            id: `action:${spec.label}:${JSON.stringify(spec.input ?? {})}`,
            label: spec.label,
            confirmation: spec.confirmation,
            values: row,
            destructive: spec.variant === "danger",
            perform: () => performRowAction(client, spec, row, onDone),
          });
        }}
      >
        {spec.icon ? <WorkbenchIcon name={spec.icon} size={14} /> : null}
        {spec.label}
      </button>
      {dialog}
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
  const { run, pending, failed, dialog } = useAction();
  const enabled = matchesWhen(row, spec.when);
  return (
    <>
      <button
        type="button"
        aria-busy={pending}
        data-state={failed ? "error" : undefined}
        disabled={pending || !enabled}
        onClick={(event) => {
          event.stopPropagation();
          run({
            id: `action:${spec.label}`,
            label: spec.label,
            confirmation: spec.confirmation,
            values: row,
            perform: () => performRowAction(client, spec, row),
          });
        }}
      >
        {spec.label}
      </button>
      {dialog}
    </>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
