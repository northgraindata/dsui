import type { z } from "zod";
import type { AnyResourceDefinition } from "../resource/types";

/**
 * Minimal structural view of an action binding, shared with UI
 * components. Components accept this shape so they never need the
 * action's input, output, or context generics.
 *
 * @example
 * ```ts
 * Button({
 *   label: "Suspend",
 *   action: suspendWarehouse({ warehouse: row.name }),
 * });
 * ```
 */
export interface ActionTarget {
  /** Discriminant: always `"action-binding"`. */
  readonly kind: "action-binding";
  /** Id of the action definition, e.g. `"suspend-warehouse"`. */
  readonly actionId: string;
  /** Validated input the runtime executes with. */
  readonly input: unknown;
}

/**
 * An action definition bound to concrete input.
 *
 * Created by calling a defined action. Calling never executes;
 * the runtime controls execution.
 */
export interface ActionBinding<TInput, TOutput, TContext = unknown>
  extends ActionTarget {
  /** Validated input, typed from the action's Zod schema. */
  readonly input: TInput;
  /** The definition this binding was created from. */
  readonly definition: ActionDefinition<TInput, TOutput, TContext>;
}

/**
 * Execution lifecycle states. Every execution moves
 * idle → running → success|error internally, leaving room for future
 * progress and cancellation APIs without changing adapter code.
 */
export type ActionExecutionStatus = "idle" | "running" | "success" | "error";

/**
 * Successful execution outcome.
 */
export interface ActionSuccess<TOutput> {
  /** Discriminant: always `"success"`. */
  readonly status: "success";
  /** Value returned by `run`. */
  readonly data: TOutput;
}

/**
 * Failed execution outcome. Query-style errors are returned, never thrown.
 */
export interface ActionFailure {
  /** Discriminant: always `"error"`. */
  readonly status: "error";
  /** The failure; external errors propagate untouched. */
  readonly error: Error;
}

/**
 * Execution outcome: success with data, or error.
 */
export type ActionResult<TOutput> = ActionSuccess<TOutput> | ActionFailure;

/**
 * A command, mutation, or side effect. Defines behavior only, never
 * presentation (labels and layout belong to components).
 *
 * Created by {@link defineAction}; never constructed by hand.
 */
export interface ActionDefinition<TInput, TOutput, TContext = unknown> {
  /** Discriminant: always `"action"`. */
  readonly kind: "action";
  /** Unique within the adapter, e.g. `"suspend-warehouse"`. */
  readonly id: string;
  /** Zod schema validating binding input; absent for inputless actions. */
  readonly inputSchema?: z.ZodTypeAny;
  /**
   * Performs the side effect. Receives validated input and the adapter
   * context augmented with runtime helpers (`invalidate`). May return
   * long-running results; the runtime tracks the execution lifecycle.
   */
  readonly run: (
    input: TInput,
    ctx: TContext & ActionRuntimeContext,
  ) => Promise<TOutput> | TOutput;
}

/**
 * Runtime helpers mixed into the context handed to `run`. The original
 * context prototype is preserved; helpers are added non-enumerably.
 *
 * @example
 * ```ts
 * run: async ({ warehouse }, ctx: Ctx & ActionRuntimeContext) => {
 *   await ctx.client.suspendWarehouse(warehouse);
 *   ctx.invalidate(warehouses);
 * },
 * ```
 */
export interface ActionRuntimeContext {
  /** Caller-owned cancellation; pass to cancellable I/O and check during work. */
  readonly signal?: AbortSignal;
  /**
   * Re-executes watched bindings: none (all), a resource (its bindings),
   * or a resource plus input (one binding).
   */
  invalidate(resource?: AnyResourceDefinition, input?: unknown): void;
}

/**
 * Structural subset for heterogeneous action collections
 * (adapter definitions, form targets).
 */
export interface AnyActionDefinition {
  /** Discriminant: always `"action"`. */
  readonly kind: "action";
  /** Unique within the adapter. */
  readonly id: string;
}

/**
 * A defined action with no input, bound as `flushCache()`.
 *
 * @example
 * ```ts
 * const flush = defineAction({ id: "flush", run: () => "ok" });
 * const binding = flush();
 * ```
 */
export type InputlessAction<TOutput, TContext = unknown> = {
  /** Creates a binding without executing. */
  (): ActionBinding<undefined, TOutput, TContext>;
  /** Discriminant: always `"action"`. */
  readonly kind: "action";
  /** Unique within the adapter. */
  readonly id: string;
  /** The underlying definition (used by the runtime). */
  readonly definition: ActionDefinition<undefined, TOutput, TContext>;
};

/**
 * A defined action with Zod-validated input, bound as
 * `resize({ warehouse, size })`.
 *
 * @example
 * ```ts
 * const resize = defineAction({
 *   id: "resize-warehouse",
 *   input: z.object({ warehouse: z.string(), size: z.string() }),
 *   run: ({ warehouse, size }, ctx) => ctx.client.resize(warehouse, size),
 * });
 * const binding = resize({ warehouse: "ETL_WH", size: "MEDIUM" });
 * ```
 */
export type InputAction<TInput, TOutput, TContext = unknown> = {
  /**
   * Validates input and creates a binding without executing.
   *
   * @param input - Caller-shaped input (Zod input side: defaults and
   * coercions still apply).
   */
  (input: TInput): ActionBinding<TInput, TOutput, TContext>;
  /** Discriminant: always `"action"`. */
  readonly kind: "action";
  /** Unique within the adapter. */
  readonly id: string;
  /** The underlying definition (used by the runtime). */
  readonly definition: ActionDefinition<TInput, TOutput, TContext>;
};
