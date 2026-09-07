import type { ComponentNode } from "../components/index";
import type { AnyStoreDefinition, StoreDefinition } from "../store/index";

type ExtractParams<Path extends string> = Path extends `${string}:${infer Rest}`
  ? Rest extends `${infer Name}/${infer Tail}`
    ? (Name extends "" ? Record<string, never> : { [K in Name]: string }) &
        ExtractParams<`/${Tail}`>
    : Rest extends ""
      ? Record<string, never>
      : { [K in Rest]: string }
  : Record<string, never>;

/**
 * Route params inferred from the page path.
 *
 * `"/databases/:database"` yields `{ database: string }`;
 * `"/tasks/:database/:schema/:task"` yields all three. Static paths
 * yield an empty record.
 *
 * @example
 * ```ts
 * definePage({
 *   path: "/databases/:database",
 *   render: ({ params }) => [PageHeader({ title: params.database })],
 * });
 * ```
 */
export type ExtractRouteParams<Path extends string> = ExtractParams<Path>;

/**
 * Store accessor handed to page render functions.
 *
 * `use()` returns live state fields merged with the store's typed actions
 * and subscribes the page, so store updates trigger re-rendering. `get()`
 * reads without subscribing.
 *
 * @example
 * ```ts
 * render: ({ stores }) => {
 *   const filters = stores.use(queryFiltersStore);
 *   return [Table({ source: queries({ search: filters.search }) })];
 * },
 * ```
 */
export interface StoreAccessor {
  /**
   * Returns live state plus actions, subscribing the page to changes.
   *
   * @param definition - The store to read (adapter- or page-scoped).
   */
  use<
    TState extends Record<string, unknown>,
    TActions extends Record<string, (...args: never[]) => unknown>,
  >(definition: StoreDefinition<TState, TActions>): Readonly<TState> & TActions;
  /**
   * Reads current state without subscribing.
   *
   * @param definition - The store to read.
   */
  get<
    TState extends Record<string, unknown>,
    TActions extends Record<string, (...args: never[]) => unknown>,
  >(definition: StoreDefinition<TState, TActions>): Readonly<TState>;
}

/**
 * Arguments passed to a page `render` function.
 */
export interface PageRenderContext<TPath extends string> {
  /** Route params inferred from the path (see {@link ExtractRouteParams}). */
  params: ExtractRouteParams<TPath>;
  /** Store accessor for reactive state and actions. */
  stores: StoreAccessor;
}

/**
 * Non-generic storage shape for page definitions. `definePage` preserves
 * the literal path type on top of this shape for param inference.
 */
export interface AnyPageDefinition {
  /** Discriminant: always `"page"`. */
  readonly kind: "page";
  /** Route path, e.g. `"/databases/:database"`. */
  readonly path: string;
  /** Page-scoped stores created with each scope. */
  readonly stores: readonly AnyStoreDefinition[];
  /**
   * Composes components and bindings. May read stores (reactive) and
   * branch on store state or params.
   */
  readonly render: (ctx: {
    params: Record<string, string>;
    stores: StoreAccessor;
  }) => ComponentNode | readonly ComponentNode[];
}
