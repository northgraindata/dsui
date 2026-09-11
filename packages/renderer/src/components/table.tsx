import type {
  TableColumn,
  PageTableRowAction as TableRowAction,
} from "@northgraindata/dsui-adapter-sdk";
import {
  Button,
  DataTable as CatalogTable,
  Surface,
} from "@northgraindata/dsui-ui";
import { useCallback, useEffect, useState } from "react";
import type { RegistryViewProps } from "../registry/view-registry";
import type { RendererClient } from "../types/renderer-types";
import { DataTable as DataGrid } from "./data-table";

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
  const disabled = !matchesWhen(row, spec.disabledWhen);
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="small"
        className="table-row-action"
        variant={
          spec.variant === "primary" ? "default" : (spec.variant ?? "secondary")
        }
        disabled={busy || disabled}
        title={
          error ?? (disabled ? String(row.restartRestriction ?? "") : undefined)
        }
        onClick={() => {
          if (
            disabled ||
            (spec.confirmation &&
              !window.confirm(
                `${spec.confirmation.title}\n\n${spec.confirmation.description}`,
              ))
          )
            return;
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

export function TableView({ client, node, renderNode }: RegistryViewProps) {
  const source = node.kind === "table" ? node.props.source : undefined;
  const columnsSource =
    node.kind === "table" ? node.props.columnsSource : undefined;
  const [data, setData] = useState<unknown>(
    node.kind === "table" ? node.props.data : undefined,
  );
  const [columnData, setColumnData] = useState<unknown>();
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh((count) => count + 1), []);
  useEffect(() => {
    if (!source && !columnsSource) return;
    let active = true;
    setError(undefined);
    Promise.all([
      source ? client.executeResource(source) : Promise.resolve(data),
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
  }, [client, source, columnsSource, refresh]);
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
  if (node.props.variant === "data") {
    const columns = node.props.columns ?? columnsFrom(columnData, rows[0]);
    return <DataGrid columns={columns} rows={rows} />;
  }
  const rowLink = node.props.rowLink;
  const rowActions = node.props.rowActions;
  const columns: readonly TableColumn[] =
    node.props.columns ?? Object.keys(rows[0]).map((id) => ({ id, label: id }));
  return (
    <CatalogTable
      columns={columns}
      rows={rows}
      renderCell={(columnId, value, row) => {
        const column = columns.find((candidate) => candidate.id === columnId);
        if (!column?.renderCell) return formatCell(value);
        const cells = Array.isArray(column.renderCell)
          ? column.renderCell
          : [column.renderCell];
        return (
          <>
            {cells.map((cell, index) => (
              <span key={`${cell.kind}-${index}`}>
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
        rowActions?.length
          ? (row) => (
              <>
                {rowActions
                  .filter((spec: any) => matchesWhen(row, spec.when))
                  .map((spec: any) => (
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
