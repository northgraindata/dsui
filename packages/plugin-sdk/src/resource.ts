/**
 * Plugin resources, mirroring the adapter SDK's `defineResource`.
 *
 * A resource is a declared, cacheable unit of data with a freshness policy.
 * The host owns refreshing: a resource declared with `refresh: poll("2s")` is
 * re-queried on that interval while a page watches it, and the browser sees
 * the same descriptor it sees for an adapter, so one polling path serves both
 * tiers.
 */
import type { z } from "zod";
import type { RefreshStrategy } from "./refresh";
import { assertNonEmptyId } from "./shared/validators";

/**
 * Any resource binding, whatever plugin context it was written against.
 *
 * `query` is contravariant in its context, so a resource declared for one
 * plugin is not assignable to a slot demanding another. The host supplies the
 * context and has no use for the declared type.
 */
export type AnyPluginResource = {
  readonly kind: "resource";
  readonly id: string;
  readonly input?: z.ZodTypeAny;
  readonly refresh: RefreshStrategy;
  readonly query: (input: any, context: any) => unknown | Promise<unknown>;
};

/** A resource definition, keeping the caller's context type. */
export type PluginResourceDefinition<
  TContext,
  TInput = undefined,
  TOutput = unknown,
> = {
  readonly kind: "resource";
  readonly id: string;
  readonly input?: z.ZodTypeAny;
  readonly refresh: RefreshStrategy;
  readonly query: (
    input: TInput,
    context: TContext,
  ) => TOutput | Promise<TOutput>;
};

/** Minimal shape a page needs to read a resource. */
export type PluginResourceLike<TOutput> = {
  readonly kind: "resource";
  readonly id: string;
  readonly refresh?: RefreshStrategy;
  query(input: unknown, context: unknown): TOutput | Promise<TOutput>;
};

/**
 * Defines a resource: declared data with a freshness policy.
 *
 * @param options.id - Unique within the plugin, e.g. `"host-metrics"`.
 * @param options.input - Schema validating the caller's input.
 * @param options.query - Reads the data; receives validated input and context.
 * @param options.refresh - Freshness declaration; defaults to `manual()`.
 * @returns A resource definition; the host queries it, never the caller.
 * @throws {@link InvalidDefinitionError} for an empty id.
 *
 * @example
 * ```ts
 * export const hostMetrics = defineResource({
 *   id: "host-metrics",
 *   query: () => ({ cpu: sampleCpu(), memory: sampleMemory() }),
 *   refresh: poll("2s"),
 * });
 * ```
 */
export function defineResource<TContext, TOutput>(options: {
  id: string;
  input?: never;
  query: (input: undefined, context: TContext) => TOutput | Promise<TOutput>;
  refresh?: RefreshStrategy;
}): PluginResourceDefinition<TContext, undefined, TOutput>;
export function defineResource<
  TContext,
  TInputSchema extends z.ZodTypeAny,
  TOutput,
>(options: {
  id: string;
  input: TInputSchema;
  query: (
    input: z.output<TInputSchema>,
    context: TContext,
  ) => TOutput | Promise<TOutput>;
  refresh?: RefreshStrategy;
}): PluginResourceDefinition<TContext, z.output<TInputSchema>, TOutput>;
export function defineResource<TContext>(options: {
  id: string;
  input?: z.ZodTypeAny;
  query: (input: never, context: TContext) => unknown;
  refresh?: RefreshStrategy;
}): PluginResourceDefinition<TContext, unknown> {
  assertNonEmptyId("Resource", options.id);
  return {
    kind: "resource",
    id: options.id,
    ...(options.input ? { input: options.input } : {}),
    refresh: options.refresh ?? { kind: "manual" },
    query: options.query as (
      input: unknown,
      context: TContext,
    ) => unknown | Promise<unknown>,
  };
}

/**
 * Describes a resource for the host catalog: the id, its input schema, and how
 * it stays fresh. This is the shape a browser reads to schedule its own
 * polling, identical to the one an adapter produces.
 *
 * @example
 * ```ts
 * catalogResource({ id: "host-metrics", refresh: poll("2s") });
 * // { id: "host-metrics", refresh: { kind: "poll", intervalMs: 2000 } }
 * ```
 */
export function catalogResource(definition: {
  id: string;
  refresh: RefreshStrategy;
  inputSchema?: unknown;
}): {
  id: string;
  refresh: RefreshStrategy;
  inputSchema?: unknown;
} {
  return {
    id: definition.id,
    refresh: definition.refresh,
    ...(definition.inputSchema ? { inputSchema: definition.inputSchema } : {}),
  };
}
