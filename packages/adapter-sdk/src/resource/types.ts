import type { z } from "zod";
import type { RefreshStrategy } from "../refresh/types";

/**
 * Minimal structural view of a resource binding, shared with UI
 * components. Components accept this shape so they never need the
 * resource's input, output, or context generics.
 *
 * @example
 * ```ts
 * Table({ source: schemas({ database: "ANALYTICS" }) });
 * ```
 */
export interface DataSource {
  /** Discriminant: always `"resource-binding"`. */
  readonly kind: "resource-binding";
  /** Id of the resource definition, e.g. `"schemas"`. */
  readonly resourceId: string;
  /** Validated input the runtime executes the query with. */
  readonly input: unknown;
}

/** Browser-safe resource reference used after page serialization. */
export interface ResourceReference {
  readonly resourceId: string;
  readonly input?: unknown;
}

/**
 * A resource definition bound to concrete input.
 *
 * Created by calling a defined resource, e.g.
 * `schemas({ database: "X" })`, which validates input and describes
 * *what* data is wanted without executing anything. The runtime controls
 * execution, refreshing, and cleanup.
 */
export interface ResourceBinding<TInput, TOutput, TContext = unknown>
  extends DataSource {
  /** Validated input, typed from the resource's Zod schema. */
  readonly input: TInput;
  /** The definition this binding was created from. */
  readonly definition: ResourceDefinition<TInput, TOutput, TContext>;
}

/**
 * A parameterized, runtime-managed source of external data.
 *
 * Created by {@link defineResource}; never constructed by hand.
 */
export interface ResourceDefinition<TInput, TOutput, TContext = unknown> {
  /** Discriminant: always `"resource"`. */
  readonly kind: "resource";
  /** Unique within the adapter, e.g. `"schemas"`. */
  readonly id: string;
  /** Zod schema validating binding input; absent for inputless resources. */
  readonly inputSchema?: z.ZodTypeAny;
  /**
   * Fetches the data. Receives validated input and the adapter context;
   * must be free of UI state (that belongs in stores).
   */
  readonly query: (input: TInput, ctx: TContext) => Promise<TOutput> | TOutput;
  /** Freshness declaration; the runtime owns timers and cleanup. */
  readonly refresh: RefreshStrategy;
}

/**
 * Structural subset for heterogeneous resource collections
 * (adapter definitions, invalidation targets).
 */
export interface AnyResourceDefinition {
  /** Discriminant: always `"resource"`. */
  readonly kind: "resource";
  /** Unique within the adapter. */
  readonly id: string;
  /** Freshness declaration. */
  readonly refresh: RefreshStrategy;
}

/**
 * A defined resource with no input, called as `warehouses()`.
 *
 * @example
 * ```ts
 * const warehouses = defineResource({
 *   id: "warehouses",
 *   query: (_, ctx) => ctx.client.listWarehouses(),
 *   refresh: poll("5s"),
 * });
 * const binding = warehouses();
 * ```
 */
export type InputlessResource<TOutput, TContext = unknown> = {
  /** Creates a binding without executing the query. */
  (): ResourceBinding<undefined, TOutput, TContext>;
  /** Discriminant: always `"resource"`. */
  readonly kind: "resource";
  /** Unique within the adapter. */
  readonly id: string;
  /** Freshness declaration. */
  readonly refresh: RefreshStrategy;
  /** The underlying definition (used by the runtime). */
  readonly definition: ResourceDefinition<undefined, TOutput, TContext>;
};

/**
 * A defined resource with Zod-validated input, called as
 * `schemas({ database: "ANALYTICS" })`.
 *
 * @example
 * ```ts
 * const schemas = defineResource({
 *   id: "schemas",
 *   input: z.object({ database: z.string() }),
 *   query: ({ database }, ctx) => ctx.client.listSchemas(database),
 * });
 * const binding = schemas({ database: "ANALYTICS" });
 * ```
 */
export type InputResource<TInput, TOutput, TContext = unknown> = {
  /**
   * Validates input and creates a binding without executing the query.
   *
   * @param input - Caller-shaped input (Zod input side: defaults and
   * coercions still apply).
   */
  (input: TInput): ResourceBinding<TInput, TOutput, TContext>;
  /** Discriminant: always `"resource"`. */
  readonly kind: "resource";
  /** Unique within the adapter. */
  readonly id: string;
  /** Freshness declaration. */
  readonly refresh: RefreshStrategy;
  /** The underlying definition (used by the runtime). */
  readonly definition: ResourceDefinition<TInput, TOutput, TContext>;
};
