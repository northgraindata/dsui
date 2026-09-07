import type { ActionBinding, ActionResult } from "../action/index";
import type { AdapterDefinition } from "../adapter/index";
import type { ComponentNode } from "../components/index";
import type { AnyPageDefinition, StoreAccessor } from "../page/index";
import type { AnyResourceDefinition, ResourceBinding } from "../resource/index";
import type { StoreDefinition, StoreInstance } from "../store/index";

/**
 * Resource execution states (internal lifecycle; surfaced to components
 * as success/error results with loading handled by the renderer).
 */
export type ResourceStatus =
  | "idle"
  | "loading"
  | "success"
  | "error"
  | "refreshing";

/**
 * Successful resource execution.
 */
export interface ResourceSuccess<TOutput> {
  /** Discriminant: always `"success"`. */
  readonly status: "success";
  /** Data returned by the resource query. */
  readonly data: TOutput;
}

/**
 * Failed resource execution. Query failures are returned, never thrown.
 */
export interface ResourceFailure {
  /** Discriminant: always `"error"`. */
  readonly status: "error";
  /** The failure; external errors propagate untouched. */
  readonly error: Error;
}

/**
 * Resource execution outcome: success with data, or error.
 */
export type ResourceResult<TOutput> =
  | ResourceSuccess<TOutput>
  | ResourceFailure;

/**
 * Options for action execution.
 */
export interface ActionExecutionOptions {
  /** Aborts a long-running action; delivered on the action context. */
  signal?: AbortSignal;
}

/**
 * A rendered page with its own store scope.
 *
 * Created per navigation via `instance.createPageScope(url)`; destroyed
 * explicitly with `dispose()`, which also destroys page-scoped stores.
 */
export interface PageScope {
  /** The page definition this scope renders. */
  readonly page: AnyPageDefinition;
  /** Decoded route params for this scope. */
  readonly params: Record<string, string>;
  /** Store accessor bound to this scope (adapter + page stores). */
  readonly stores: StoreAccessor;
  /**
   * Renders the component tree. Reactive: re-call after `onUpdate`
   * fires to pick up store-driven changes.
   */
  render(): ComponentNode | readonly ComponentNode[];
  /**
   * Subscribes to store changes affecting this scope.
   *
   * @param listener - Called whenever a used store changes.
   * @returns Unsubscribe function.
   */
  onUpdate(listener: () => void): () => void;
  /** Destroys page-scoped stores and releases subscriptions. */
  dispose(): void;
}

/**
 * A live adapter instance: one configured connection with isolated
 * context, stores, and execution state (e.g. `snowflake-prod`).
 *
 * Created by {@link createAdapterInstance}; never constructed by hand.
 */
export interface AdapterInstance<TContext = unknown> {
  /** The definition this instance was created from. */
  readonly definition: AdapterDefinition<TContext, unknown>;
  /** Runtime dependencies built by the definition's context factory. */
  readonly context: TContext;
  /**
   * Returns the adapter-scoped store instance, creating it on first use.
   * Page-scoped stores are created per page scope instead.
   *
   * @param definition - The store definition.
   */
  store<
    TState extends Record<string, unknown>,
    TActions extends Record<string, (...args: never[]) => unknown>,
  >(
    definition: StoreDefinition<TState, TActions>,
  ): StoreInstance<TState, TActions>;
  /**
   * Executes a resource binding once.
   *
   * @param binding - Any context-specific binding is accepted; the
   * runtime supplies the instance context.
   */
  executeResource<TInput, TOutput>(
    binding: ResourceBinding<TInput, TOutput, never>,
  ): Promise<ResourceResult<TOutput>>;
  /**
   * Subscribes to a binding: immediate execution plus runtime-managed
   * refreshing. The last unsubscribe tears the execution down.
   *
   * @param binding - The binding to watch.
   * @param listener - Called with each result, including the latest
   * cached one on subscribe.
   * @returns Unsubscribe function.
   */
  watchResource<TInput, TOutput>(
    binding: ResourceBinding<TInput, TOutput, never>,
    listener: (result: ResourceResult<TOutput>) => void,
  ): () => void;
  /**
   * Executes an action binding.
   *
   * @param binding - Any context-specific binding is accepted.
   * @param options - Optional abort signal.
   */
  executeAction<TInput, TOutput>(
    binding: ActionBinding<TInput, TOutput, never>,
    options?: ActionExecutionOptions,
  ): Promise<ActionResult<TOutput>>;
  /**
   * Re-executes watched bindings: none (all), a resource (its
   * bindings), or a resource plus input (one binding).
   *
   * @param resource - Resource to narrow invalidation to.
   * @param input - Binding input to narrow invalidation to.
   */
  invalidate(resource?: AnyResourceDefinition, input?: unknown): void;
  /**
   * Creates a page scope for a URL, resolving the matching page.
   *
   * @param url - Concrete URL, e.g. `"/databases/ANALYTICS"`.
   * @throws {@link UnknownPageError} when nothing matches.
   */
  createPageScope(url: string): PageScope;
  /**
   * Creates a page scope for a definition with explicit params.
   *
   * @param page - The page definition.
   * @param params - Route params (default: none).
   */
  createPageScopeFor(
    page: AnyPageDefinition,
    params?: Record<string, string>,
  ): PageScope;
  /**
   * Tears everything down: stops polling, destroys stores, then
   * disposes the context. Safe to call more than once.
   */
  dispose(): Promise<void>;
}
