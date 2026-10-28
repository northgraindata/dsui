import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type DisplayPreferences,
  formatDisplayDate,
  useDisplayPreferences,
} from "./preferences";
import {
  columnProfiles,
  type QuerySortDirection,
  sortQueryRows,
} from "./query-editor/column-profile";
import { ColumnProfileHeader } from "./query-editor/column-profile-header";

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
  const preferences = useDisplayPreferences();
  const profiles = useMemo(
    () => columnProfiles(columns, rows),
    [columns, rows],
  );
  const [sortState, setSortState] = useState<{
    rows: readonly Record<string, unknown>[];
    name: string;
    direction: QuerySortDirection;
  }>();
  const sort = sortState?.rows === rows ? sortState : undefined;
  const sortProfile = profiles.find((profile) => profile.name === sort?.name);
  const visibleRows = useMemo(
    () =>
      sort && sortProfile
        ? sortQueryRows(rows, sortProfile, sort.direction)
        : rows,
    [rows, sort, sortProfile],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (preferences.density === "compact" ? 25 : 31),
    overscan: 10,
  });
  useEffect(() => {
    if (visibleRows.length > 0) scrollRef.current?.scrollTo({ top: 0 });
  }, [visibleRows]);
  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const lastRow = virtualRows[virtualRows.length - 1];
  const paddingBottom = lastRow ? virtualizer.getTotalSize() - lastRow.end : 0;
  return (
    <div className={`data-table-scroll ${className}`} ref={scrollRef}>
      <table className="data-table">
        <thead>
          <tr>
            {profiles.map((profile) => (
              <th
                key={profile.name}
                className="query-profile-header"
                aria-sort={ariaSort(
                  sort?.name === profile.name ? sort.direction : undefined,
                )}
              >
                <ColumnProfileHeader
                  profile={profile}
                  sortDirection={
                    sort?.name === profile.name ? sort.direction : undefined
                  }
                  onSort={() =>
                    setSortState((current) => {
                      const active =
                        current?.rows === rows ? current : undefined;
                      if (active?.name !== profile.name)
                        return { rows, name: profile.name, direction: "asc" };
                      if (active.direction === "asc")
                        return { rows, name: profile.name, direction: "desc" };
                      return undefined;
                    })
                  }
                />
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
            const row = visibleRows[virtualRow.index];
            return (
              <tr
                key={`${virtualRow.index}:${JSON.stringify(row)}`}
                ref={virtualizer.measureElement}
              >
                {columns.map((column) => (
                  <td key={column.name}>
                    {cellContent(row[column.name], column.type, preferences)}
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

function ariaSort(direction?: QuerySortDirection) {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function cellContent(
  value: unknown,
  type: string | undefined,
  preferences: DisplayPreferences,
) {
  if (value === null) return <span className="data-table-null">NULL</span>;
  if (/TIMESTAMP|DATETIME/i.test(type ?? "") && typeof value === "string")
    return formatDisplayDate(value, preferences);
  return cellText(value);
}
