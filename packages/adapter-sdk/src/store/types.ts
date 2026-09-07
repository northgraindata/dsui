/**
 * Store scope: how long state lives.
 *
 * - `"adapter"`: one instance per adapter instance (e.g. selected
 *   warehouse); survives page navigation, destroyed with the instance.
 * - `"page"`: one instance per rendered page (e.g. filters, editor
 *   content); destroyed when the page scope is disposed.
 *
 * @example
 * ```ts
 * defineStore({ id: "session", scope: "adapter", state: {...}, actions });
 * ```
 */
export type StoreScope = "adapter" | "page";

/**
 * State helpers handed to a store's `actions` factory. Bound to one
 * store instance; actions close over them.
 */
export interface StoreHelpers<TState extends Record<string, unknown>> {
  /**
   * Current state snapshot (a copy; mutating it changes nothing).
   */
  get(): Readonly<TState>;
  /**
   * Merges a partial state update and notifies subscribers.
   *
   * @param patch - Partial state to merge over the current state.
   */
  set(patch: Partial<TState>): void;
  /** Restores the definition's initial state and notifies subscribers. */
  reset(): void;
}

/**
 * Client/session/UI state owned by the adapter.
 *
 * External data belongs in resources; stores hold local state such as
 * the selected warehouse, filters, or editor content. Created by
 * {@link defineStore}; never constructed by hand.
 */
export interface StoreDefinition<
  TState extends Record<string, unknown>,
  TActions extends Record<string, (...args: never[]) => unknown>,
> {
  /** Discriminant: always `"store"`. */
  readonly kind: "store";
  /** Unique within its scope, e.g. `"session"`, `"query-filters"`. */
  readonly id: string;
  /** Lifetime of the state (adapter- or page-scoped). */
  readonly scope: StoreScope;
  /** Frozen at definition time; instances start as copies of it. */
  readonly initialState: Readonly<TState>;
  /** Builds typed actions bound to one store instance. */
  readonly createActions: (helpers: StoreHelpers<TState>) => TActions;
}

/**
 * Structural subset used for heterogeneous store collections
 * (pages, adapters).
 */
export interface AnyStoreDefinition {
  /** Discriminant: always `"store"`. */
  readonly kind: "store";
  /** Unique within its scope. */
  readonly id: string;
  /** Lifetime of the state. */
  readonly scope: StoreScope;
}

/**
 * A live store: isolated state plus typed actions plus subscriptions.
 *
 * Created per scope by the runtime via `createStoreInstance`; adapter
 * code receives instances through `stores.use()` in page renders or
 * `instance.store()` in tests.
 */
export interface StoreInstance<
  TState extends Record<string, unknown>,
  TActions extends Record<string, (...args: never[]) => unknown>,
> {
  /** The definition this instance was created from. */
  readonly definition: StoreDefinition<TState, TActions>;
  /**
   * Current state snapshot (a copy).
   */
  get(): Readonly<TState>;
  /**
   * Merges a partial update and notifies subscribers.
   *
   * @param patch - Partial state to merge.
   */
  set(patch: Partial<TState>): void;
  /** Restores initial state and notifies subscribers. */
  reset(): void;
  /**
   * Subscribes to state changes.
   *
   * @param listener - Called with each new snapshot after a change.
   * @returns Unsubscribe function.
   */
  subscribe(listener: (state: Readonly<TState>) => void): () => void;
  /** Typed actions built by the definition's `actions` factory. */
  readonly actions: TActions;
  /** Releases all subscriptions; called by the runtime on scope disposal. */
  destroy(): void;
}
