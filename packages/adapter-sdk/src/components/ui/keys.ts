export { keyedRows } from "@northgraindata/dsui-ui";

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
