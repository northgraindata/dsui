/** The pure parts of a paged view, kept apart so they can be tested alone. */
export interface PageState {
  offset: number;
  size: number;
  search: string;
  filters: Readonly<Record<string, string>>;
}

export function initialPageState(size = 25): PageState {
  return { offset: 0, size, search: "", filters: {} };
}

/** The resource input for a state. Empty filters are left to their defaults. */
export function pageRequest(
  input: unknown,
  state: PageState,
): Record<string, unknown> {
  const chosen = Object.fromEntries(
    Object.entries(state.filters).filter(([, value]) => value !== ""),
  );
  return {
    ...(typeof input === "object" && input !== null ? input : {}),
    ...chosen,
    limit: state.size,
    offset: state.offset,
    search: state.search.trim(),
  };
}

export function readPage(
  value: unknown,
): { items: Record<string, unknown>[]; total: number } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { items, total } = value as { items?: unknown; total?: unknown };
  if (!Array.isArray(items) || typeof total !== "number") return undefined;
  return {
    items: items.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    ),
    total,
  };
}

/** "26–50 of 1,284"; the last page ends at the total. */
export function pageSummary(offset: number, shown: number, total: number) {
  if (!shown) return "0 results";
  const format = (value: number) => value.toLocaleString("en-US");
  return `${format(offset + 1)}–${format(offset + shown)} of ${format(total)}`;
}

/** Where the last page starts, for when records disappear under the reader. */
export function lastOffset(total: number, size: number) {
  return Math.max(0, Math.floor((total - 1) / size) * size);
}
