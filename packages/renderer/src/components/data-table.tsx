import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import { WorkbenchIcon } from "./icons";

export interface DataTableColumn {
  name: string;
  type?: string;
}

export function DataTable({
  columns,
  rows,
  className = "",
}: {
  columns: readonly DataTableColumn[];
  rows: readonly Record<string, unknown>[];
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 31,
    overscan: 10,
  });
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [rows]);
  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const lastRow = virtualRows[virtualRows.length - 1];
  const paddingBottom = lastRow ? virtualizer.getTotalSize() - lastRow.end : 0;
  return (
    <div className={`data-table-scroll ${className}`} ref={scrollRef}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.name}>
                <div>
                  <WorkbenchIcon name={columnIcon(column.type)} size={18} />
                  <span>
                    {column.name}
                    <small>{column.type ?? "TYPE UNAVAILABLE"}</small>
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 ? (
            <tr className="data-table-virtual-spacer">
              <td
                colSpan={columns.length || 1}
                style={{ height: paddingTop }}
              />
            </tr>
          ) : null}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <tr
                key={`${virtualRow.index}:${JSON.stringify(row)}`}
                ref={virtualizer.measureElement}
              >
                {columns.map((column) => (
                  <td key={column.name}>
                    {row[column.name] === null ? (
                      <span className="data-table-null">NULL</span>
                    ) : (
                      cellText(row[column.name])
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
          {paddingBottom > 0 ? (
            <tr className="data-table-virtual-spacer">
              <td
                colSpan={columns.length || 1}
                style={{ height: paddingBottom }}
              />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function columnIcon(type?: string) {
  return type && /DATE|TIME/i.test(type) ? "calendar" : "hash";
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
