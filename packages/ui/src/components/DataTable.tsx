import type { ReactNode } from "react";
import { Surface } from "./Surface";

export function DataTable({
  columns,
  rows,
  onRowClick,
  renderRowActions,
}: {
  columns: readonly { id: string; label: string }[];
  rows: readonly Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
  renderRowActions?: (row: Record<string, unknown>) => ReactNode;
}) {
  return (
    <Surface className="overflow-x-auto">
      <table className="dsui-data-table w-full border-collapse text-left text-[12px]">
        <thead className="border-b border-border bg-surface-raised text-secondary">
          <tr>
            {columns.map((column) => (
              <th key={column.id} className="px-3 py-2 font-medium">
                {column.label}
              </th>
            ))}
            {renderRowActions !== undefined ? (
              <th key="__actions" className="px-3 py-2 font-medium">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={JSON.stringify(row)}
              className="border-b border-border last:border-0"
            >
              {columns.map((column, index) => (
                <td
                  key={column.id}
                  className="max-w-72 truncate px-3 py-2 text-primary"
                >
                  {index === 0 && onRowClick ? (
                    <button
                      type="button"
                      onClick={() => onRowClick(row)}
                      className="cursor-pointer bg-transparent p-0 text-left text-accent hover:underline"
                    >
                      {renderCell(column.id, row[column.id])}
                    </button>
                  ) : (
                    renderCell(column.id, row[column.id])
                  )}
                </td>
              ))}
              {renderRowActions !== undefined ? (
                <td key="__actions" className="px-3 py-2">
                  <span className="flex flex-wrap gap-2">
                    {renderRowActions(row)}
                  </span>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}

function renderCell(columnId: string, value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return "—";

  if (columnId === "isPaused" && typeof value === "boolean") {
    return value ? (
      <span className="inline-flex items-center gap-1.5 rounded border border-warning/30 bg-warning/10 px-2 py-0.5 font-mono text-[10.5px] text-warning">
        <span className="size-1.5 rounded-full bg-warning" />
        Paused
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded border border-healthy/30 bg-healthy/10 px-2 py-0.5 font-mono text-[10.5px] text-healthy">
        <span className="size-1.5 rounded-full bg-healthy" />
        Active
      </span>
    );
  }

  if (
    (columnId === "state" || columnId === "status") &&
    typeof value === "string"
  ) {
    const s = value.toLowerCase().trim();
    const isSuccess = s === "success" || s === "healthy";
    const isFailed =
      s === "failed" || s === "upstream_failed" || s === "unavailable";
    const isRunning = s === "running" || s === "restarting";
    const isWarning =
      s === "queued" ||
      s === "scheduled" ||
      s === "deferred" ||
      s === "up_for_retry" ||
      s === "up_for_reschedule";

    const badgeClass = isSuccess
      ? "border-healthy/30 bg-healthy/10 text-healthy"
      : isFailed
        ? "border-unavailable/30 bg-unavailable/10 text-unavailable"
        : isRunning
          ? "border-accent/40 bg-accent/15 text-accent"
          : isWarning
            ? "border-warning/30 bg-warning/10 text-warning"
            : "border-border bg-surface-raised text-muted";

    const dotClass = isSuccess
      ? "bg-healthy"
      : isFailed
        ? "bg-unavailable"
        : isRunning
          ? "bg-accent animate-pulse motion-reduce:animate-none"
          : isWarning
            ? "bg-warning"
            : "bg-unknown";

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10.5px] lowercase ${badgeClass}`}
      >
        <span className={`size-1.5 shrink-0 rounded-full ${dotClass}`} />
        {value.replaceAll("_", " ")}
      </span>
    );
  }

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
