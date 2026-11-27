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
