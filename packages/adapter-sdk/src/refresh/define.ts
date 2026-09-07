import { InvalidDefinitionError } from "../shared/errors";
import type { PollInterval, RefreshStrategy } from "./types";

/**
 * A resource that never refreshes on its own; the runtime fetches it on
 * mount and on explicit invalidation.
 *
 * @example
 * ```ts
 * defineResource({
 *   id: "table-details",
 *   input: z.object({ table: z.string() }),
 *   query: ({ table }, ctx) => ctx.client.getTable(table),
 *   refresh: manual(),
 * });
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
 * @throws {@link InvalidDefinitionError} for unparseable or
 * non-positive intervals.
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
