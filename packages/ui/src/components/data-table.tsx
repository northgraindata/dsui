import type { ReactNode } from "react";
import { Surface } from "./surface";

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
                      {formatCell(row[column.id])}
                    </button>
                  ) : (
                    formatCell(row[column.id])
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

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
