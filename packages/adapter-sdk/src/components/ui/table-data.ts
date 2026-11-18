import type { TableColumn, TableFilter } from "../primitives/table";

export type SortDirection = "asc" | "desc";
export type ColumnFilter = Record<string, string[]>;
export type FilterOption = { key: string; label: string; count: number };

export function valueKey(value: unknown): string {
  return JSON.stringify([typeof value, value]);
}

export function valueLabel(value: unknown): string {
  if (value === null || value === undefined) return "(null)";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function columnOptions(
  rows: readonly Record<string, unknown>[],
  columnId: string,
  filter?: TableFilter,
): FilterOption[] {
  const counts = new Map<string, FilterOption>();
  for (const row of rows) {
    const value = row[columnId];
    const key = valueKey(value);
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { key, label: valueLabel(value), count: 1 });
  }
  if (filter)
    return filter.options.map((option) => {
      const match = [...counts.values()].find(
        (entry) =>
          entry.key === valueKey(option.value) ||
          entry.label === String(option.value),
      );
      return {
        key: match?.key ?? valueKey(option.value),
        label: option.label,
        count: match?.count ?? 0,
      };
    });
  return [...counts.values()].sort(
    (left, right) =>
      right.count - left.count || left.label.localeCompare(right.label),
  );
}

export function exploreRows({
  rows,
  columns,
  search,
  filters,
  sort,
}: {
  rows: readonly Record<string, unknown>[];
  columns: readonly TableColumn[];
  search: string;
  filters: ColumnFilter;
  sort?: { columnId: string; direction: SortDirection };
}): Record<string, unknown>[] {
  const query = search.trim().toLocaleLowerCase();
  const filtered = rows.filter((row) => {
    if (
      query &&
      !columns.some((column) =>
        valueLabel(row[column.id]).toLocaleLowerCase().includes(query),
      )
    )
      return false;
    return Object.entries(filters).every(
      ([columnId, keys]) =>
        keys.length === 0 || keys.includes(valueKey(row[columnId])),
    );
  });
  if (!sort) return filtered;
  return filtered.sort((left, right) => {
    const first = left[sort.columnId];
    const second = right[sort.columnId];
    if (first == null) return second == null ? 0 : 1;
    if (second == null) return -1;
    const comparison =
      typeof first === "number" && typeof second === "number"
        ? first - second
        : valueLabel(first).localeCompare(valueLabel(second), undefined, {
            numeric: true,
          });
    return sort.direction === "asc" ? comparison : -comparison;
  });
}

export interface TableInsightsData {
  sampleSize: number;
  numeric?: {
    column: TableColumn;
    min: number;
    max: number;
    average: number;
    bins: number[];
  };
  top?: { column: TableColumn; values: FilterOption[] };
  distinct: { column: TableColumn; count: number }[];
}

export function tableInsights(
  rows: readonly Record<string, unknown>[],
  columns: readonly TableColumn[],
): TableInsightsData {
  const numericColumns = columns.filter(
    (column) =>
      rows.filter(
        (row) =>
          typeof row[column.id] === "number" && Number.isFinite(row[column.id]),
      ).length >= 2,
  );
  const numericColumn =
    numericColumns.find((column) => !/(^id$|_id$)/i.test(column.id)) ??
    numericColumns[0];
  const numbers = numericColumn
    ? rows.flatMap((row) => {
        const value = row[numericColumn.id];
        return typeof value === "number" && Number.isFinite(value)
          ? [value]
          : [];
      })
    : [];
  const min = numbers.length ? Math.min(...numbers) : 0;
  const max = numbers.length ? Math.max(...numbers) : 0;
  const bins = Array.from({ length: 8 }, () => 0);
  for (const number of numbers) {
    const index =
      min === max
        ? 0
        : Math.min(7, Math.floor(((number - min) / (max - min)) * 8));
    bins[index] = (bins[index] ?? 0) + 1;
  }
  const topColumn = columns.find((column) => {
    const values = rows.map((row) => row[column.id]);
    return (
      values.some((value) => typeof value === "string") &&
      new Set(values.map(valueKey)).size > 1 &&
      new Set(values.map(valueKey)).size < rows.length
    );
  });
  const distinctColumns = [columns[0], topColumn ?? columns[1]].filter(
    (column, index, selected): column is TableColumn =>
      Boolean(column) &&
      selected.findIndex((item) => item?.id === column?.id) === index,
  );
  return {
    sampleSize: rows.length,
    ...(numericColumn
      ? {
          numeric: {
            column: numericColumn,
            min,
            max,
            average:
              numbers.reduce((sum, number) => sum + number, 0) / numbers.length,
            bins,
          },
        }
      : {}),
    ...(topColumn
      ? {
          top: {
            column: topColumn,
            values: columnOptions(rows, topColumn.id).slice(0, 4),
          },
        }
      : {}),
    distinct: distinctColumns.map((column) => ({
      column,
      count: new Set(rows.map((row) => valueKey(row[column.id]))).size,
    })),
  };
}
