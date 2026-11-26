/**
 * React keys for declarative nodes and data rows.
 *
 * Keys must survive prop and data changes: a key derived from content remounts
 * the subtree on every refresh and drops editor text, scroll and open panels.
 */

/** Pages declare children in a fixed order, so position plus kind is stable. */
export function positioned<T extends { readonly kind: string }>(
  items: readonly T[],
): { item: T; key: string }[] {
  return items.map((item, index) => ({ item, key: `${index}:${item.kind}` }));
}

const IDENTITY_FIELDS = ["id", "key", "name", "title"] as const;

/**
 * Data rows can reorder between refreshes, so they are keyed by an identity
 * field when one exists. Duplicates and anonymous rows fall back to position.
 */
export function keyedRows<T extends object>(
  rows: readonly T[],
): { item: T; key: string }[] {
  const seen = new Set<string>();
  return rows.map((item, index) => {
    const record = item as Record<string, unknown>;
    const field = IDENTITY_FIELDS.find((name) => {
      const value = record[name];
      return typeof value === "string" || typeof value === "number";
    });
    let key = field ? `${field}:${String(record[field])}` : `row:${index}`;
    if (seen.has(key)) key = `${key}#${index}`;
    seen.add(key);
    return { item, key };
  });
}
