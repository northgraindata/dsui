/**
 * Serializable freshness declarations for resources.
 *
 * A spec describes *how* a resource stays fresh; the runtime owns the
 * behavior behind it (see {@link RefreshPolicy}). Specs are plain data so
 * they can cross process boundaries in the future.
 */

/**
 * Poll interval shorthand: `"500ms"`, `"5s"`, `"2m"`, or raw milliseconds.
 *
 * @example
 * ```ts
 * refresh: poll("30s"),
 * ```
 */
export type PollInterval = `${number}ms` | `${number}s` | `${number}m` | number;

/**
 * Freshness declaration stored on a resource definition.
 *
 * - `{ kind: "manual" }`: fetched on mount, never refreshed alone.
 * - `{ kind: "poll", intervalMs }`: re-fetched on a fixed interval
 *   while watched.
 *
 * @example
 * ```ts
 * defineResource({
 *   id: "warehouses",
 *   query: (_, ctx) => ctx.client.listWarehouses(),
 *   refresh: poll("5s"),
 * });
 * ```
 */
export type RefreshStrategy =
  | { readonly kind: "manual" }
  | { readonly kind: "poll"; readonly intervalMs: number };
