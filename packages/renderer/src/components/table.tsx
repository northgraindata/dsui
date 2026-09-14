import type {
  TableColumn,
  TableFilter,
  PageTableRowAction as TableRowAction,
  TableRowMenuAction,
} from "@northgraindata/dsui-adapter-sdk";
import {
  Button,
  DataTable as CatalogTable,
  Dialog,
  DialogContent,
  Input,
  Surface,
} from "@northgraindata/dsui-ui";
import { useCallback, useEffect, useId, useState } from "react";
import type { RegistryViewProps } from "../registry/view-registry";
import type { RendererClient } from "../types/renderer-types";
import { DataTable as DataGrid } from "./data-table";
import { WorkbenchIcon } from "./icons";

/** Fills :param placeholders from row fields; null when a field is missing. */
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

/** Resolves a destination from object-shaped successful action data. */
export function resolveActionSuccessLink(
  link: { path: string; params: Record<string, string> },
  data: unknown,
): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return resolveLink(link.path, link.params, data as Record<string, unknown>);
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const disabled = !matchesWhen(row, spec.disabledWhen);
  const execute = () => {
    if (disabled || !spec.action) return;
    const input: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(spec.action.input ?? {})) {
      input[key] = row[field];
    }
    setBusy(true);
    setError(undefined);
    client
      .executeAction({ actionId: spec.action.actionId, input })
      .then((result) => {
        if (result.status !== "success") {
          setError(result.message ?? "Action failed");
          return;
        }
        const destination = spec.successLink
          ? resolveActionSuccessLink(spec.successLink, result.data)
          : null;
        if (destination) client.navigate(destination);
        else onDone();
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Action failed"),
      )
      .finally(() => setBusy(false));
  };
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size={spec.icon ? "icon" : "small"}
        className={
          spec.icon
            ? "table-row-action table-row-action--icon"
            : "table-row-action"
        }
        variant={
          spec.variant === "primary" ? "default" : (spec.variant ?? "secondary")
        }
        disabled={busy || disabled}
        aria-label={spec.label}
        title={
          error ?? (disabled ? String(row.restartRestriction ?? "") : undefined)
        }
        onClick={() => {
          if (disabled) return;
          if (spec.link) {
            const destination = resolveLink(
              spec.link.path,
              spec.link.params,
              row,
            );
            if (destination) client.navigate(destination);
            return;
          }
          if (spec.confirmation) {
            setConfirmOpen(true);
            return;
          }
          execute();
        }}
      >
        {spec.icon ? <WorkbenchIcon name={spec.icon} size={16} /> : spec.label}
      </Button>
      {spec.confirmation ? (
        <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent
            title={spec.confirmation.title}
            description={spec.confirmation.description}
          >
            <div className="flex justify-end gap-3 pt-5">
              <Dialog.Close asChild>
                <Button variant="ghost" disabled={busy}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                variant={spec.variant === "danger" ? "danger" : "default"}
                disabled={busy}
                onClick={() => {
                  setConfirmOpen(false);
                  execute();
                }}
              >
                {busy
                  ? `${spec.confirmation.confirmLabel ?? spec.label}…`
                  : (spec.confirmation.confirmLabel ?? spec.label)}
              </Button>
            </div>
          </DialogContent>
        </Dialog.Root>
      ) : null}
      {error ? (
        <span className="text-[10px] text-unavailable">{error}</span>
      ) : null}
    </span>
  );
}

export function TableView({ client, node, renderNode }: RegistryViewProps) {
  const source = node.kind === "table" ? node.props.source : undefined;
  const columnsSource =
    node.kind === "table" ? node.props.columnsSource : undefined;
  const initialData = node.kind === "table" ? node.props.data : undefined;
  const [data, setData] = useState<unknown>(initialData);
  const [columnData, setColumnData] = useState<unknown>();
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const searchId = useId();
  const reload = useCallback(() => setRefresh((count) => count + 1), []);
  useEffect(() => {
    if (!source && !columnsSource) return;
    void refresh;
    let active = true;
    setError(undefined);
    Promise.all([
      source ? client.executeResource(source) : Promise.resolve(initialData),
      columnsSource
        ? client.executeResource(columnsSource)
        : Promise.resolve(undefined),
    ])
      .then(([result, columns]) => {
        if (!active) return;
        setData(result);
        setColumnData(columns);
      })
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
  }, [client, source, columnsSource, initialData, refresh]);
  if (node.kind !== "table") return null;
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
  const rows: Record<string, unknown>[] = Array.isArray(data)
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
  if (node.props.variant === "data") {
    const columns = node.props.columns ?? columnsFrom(columnData, rows[0]);
    return <DataGrid columns={columns} rows={rows} />;
  }
  const rowLink = node.props.rowLink;
  const rowActions = (node.props.rowActions ?? []) as readonly TableRowAction[];
  const menuActions = node.props.actions;
  const columns: readonly TableColumn[] =
    node.props.columns ?? Object.keys(rows[0]).map((id) => ({ id, label: id }));
  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      !search ||
      columns.some((column) =>
        String(row[column.id] ?? "")
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
      );
    return (
      matchesSearch &&
      (node.props.filters ?? []).every(
        (filter: TableFilter) =>
          !filters[filter.field] ||
          String(row[filter.field] ?? "") === filters[filter.field],
      )
    );
  });
  const pageSize = node.props.pageSize;
  const pageCount = pageSize
    ? Math.max(1, Math.ceil(filteredRows.length / pageSize))
    : 1;
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = pageSize
    ? filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : filteredRows;
  return (
    <div className="grid gap-3">
      {node.props.searchable || node.props.filters?.length ? (
        <div className="flex flex-wrap items-end gap-2">
          {node.props.searchable ? (
            <div className="grid gap-1 text-[11px] text-secondary">
              <label htmlFor={searchId}>Search</label>
              <Input
                id={searchId}
                type="search"
                value={search}
                placeholder="Search records"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </div>
          ) : null}
          {(node.props.filters ?? []).map((filter: TableFilter) => (
            <label
              key={filter.field}
              className="grid gap-1 text-[11px] text-secondary"
            >
              {filter.label}
              <select
                className="min-h-[34px] border border-border-strong bg-background px-2.5 text-[12px] text-primary"
                value={filters[filter.field] ?? ""}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    [filter.field]: event.target.value,
                  }));
                  setPage(0);
                }}
              >
                <option value="">All</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}
      <CatalogTable
        columns={columns}
        rows={visibleRows}
        renderCell={(columnId, value, row) => {
          const column = columns.find((candidate) => candidate.id === columnId);
          if (!column?.renderCell) return formatCell(value);
          const cells = Array.isArray(column.renderCell)
            ? column.renderCell
            : [column.renderCell];
          return (
            <>
              {cells.map((cell) => (
                <span key={`${cell.kind}:${JSON.stringify(cell.props)}`}>
                  {renderNode(client, cell, row)}
                </span>
              ))}
            </>
          );
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
          rowActions.length
            ? (row) => (
                <>
                  {rowActions
                    .filter((spec) => matchesWhen(row, spec.when))
                    .map((spec) => (
                      <RowActionButton
                        key={`${spec.label}:${spec.action?.actionId ?? spec.link?.path}`}
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
        renderRowMenu={
          menuActions?.length
            ? (row) =>
                menuActions
                  .filter((spec: TableRowMenuAction) =>
                    matchesWhen(row, spec.when),
                  )
                  .map((spec: TableRowMenuAction) => (
                    <MenuAction
                      key={spec.label}
                      client={client}
                      spec={spec}
                      row={row}
                      onDone={reload}
                    />
                  ))
            : undefined
        }
      />
      {pageSize && filteredRows.length > pageSize ? (
        <div className="flex items-center justify-between gap-3 text-[12px] text-secondary">
          <span>
            Page {currentPage + 1} of {pageCount} · {filteredRows.length}{" "}
            records
          </span>
          <div className="flex gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuAction({
  client,
  spec,
  row,
  onDone,
}: {
  client: RendererClient;
  spec: TableRowMenuAction;
  row: Record<string, unknown>;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const action =
    typeof spec.action === "object" && spec.action !== null
      ? (spec.action as { actionId?: string; input?: Record<string, string> })
      : undefined;
  return (
    <button
      type="button"
      className="dsui-data-table-menu-item"
      disabled={busy}
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
        if (!action?.actionId) return;
        const input: Record<string, unknown> = {};
        for (const [key, field] of Object.entries(action.input ?? {}))
          input[key] = row[field];
        setBusy(true);
        client
          .executeAction({ actionId: action.actionId, input })
          .then((result) => {
            if (result.status !== "success") return;
            const destination = spec.successLink
              ? resolveActionSuccessLink(spec.successLink, result.data)
              : null;
            if (destination) client.navigate(destination);
            else onDone();
          })
          .finally(() => setBusy(false));
      }}
    >
      {spec.label}
    </button>
  );
}

function columnsFrom(
  value: unknown,
  firstRow: Record<string, unknown>,
): { name: string; type?: string }[] {
  if (Array.isArray(value)) {
    const metadata = value.filter(
      (entry): entry is Record<string, unknown> =>
        entry !== null && typeof entry === "object" && !Array.isArray(entry),
    );
    if (metadata.length > 0) {
      return metadata.map((column) => ({
        name: String(column.name ?? column.id ?? column.label),
        ...(column.type ? { type: String(column.type) } : {}),
      }));
    }
  }
  return Object.keys(firstRow).map((name) => ({ name }));
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
