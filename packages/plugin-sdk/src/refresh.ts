import { InvalidDefinitionError } from "./shared/errors";

/**
 * Freshness declarations for plugin resources, mirroring the adapter SDK.
 *
 * A plugin declares how fresh a resource should be; the host owns the
 * behaviour. A browser reading a plugin page sees the same descriptor it sees
 * for an adapter, so it needs no plugin-specific polling path.
 */

/**
 * Poll interval shorthand: `"500ms"`, `"5s"`, `"2m"`, or raw milliseconds.
 *
 * @example
 * ```ts
 * refresh: poll("5s"),
 * ```
 */
export type PollInterval = `${number}ms` | `${number}s` | `${number}m` | number;

/**
 * Freshness declaration stored on a resource definition.
 *
 * - `{ kind: "manual" }`: fetched on mount, never refreshed alone.
 * - `{ kind: "poll", intervalMs }`: re-fetched on a fixed interval while
 *   watched.
 */
export type RefreshStrategy =
  | { readonly kind: "manual" }
  | { readonly kind: "poll"; readonly intervalMs: number };

/**
 * A resource that never refreshes on its own; the host fetches it on mount
 * and on explicit invalidation.
 *
 * @example
 * ```ts
 * defineResource({ id: "teams", query: (_, ctx) => ctx.listTeams() });
 * ```
 */
export function manual(): RefreshStrategy {
  return { kind: "manual" };
}

/**
 * Poll the resource on a fixed interval while it is watched.
 *
 * @param interval - `"500ms"`, `"5s"`, `"2m"`, or raw milliseconds.
 * @returns A serializable `{ kind: "poll", intervalMs }` descriptor.
 * @throws {@link InvalidDefinitionError} for unparseable or non-positive
 * intervals.
 *
 * @example
 * ```ts
 * defineResource({
 *   id: "host-metrics",
 *   query: () => sampleCpu(),
 *   refresh: poll("2s"),
 * });
 * ```
 */
export function poll(interval: PollInterval): RefreshStrategy {
  const intervalMs =
    typeof interval === "number" ? interval : parseInterval(interval);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0)
    throw new InvalidDefinitionError(
      `Invalid poll interval: ${String(interval)}`,
    );
  return { kind: "poll", intervalMs };
}

function parseInterval(raw: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m)$/.exec(raw.trim());
  if (!match)
    throw new InvalidDefinitionError(
      `Invalid poll interval "${raw}" (expected e.g. "500ms", "5s", "2m")`,
    );
  const value = Number(match[1]);
  if (match[2] === "ms") return value;
  if (match[2] === "s") return value * 1000;
  return value * 60_000;
}
