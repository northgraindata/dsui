import {
  type AnyStoreDefinition,
  createStoreInstance,
  type StoreDefinition,
  type StoreInstance,
} from "../store/index";

type AnyInstance = StoreInstance<
  Record<string, unknown>,
  Record<string, (...args: never[]) => unknown>
>;

interface ScopeSources {
  readonly stores: readonly AnyStoreDefinition[];
  readonly pages: readonly { readonly stores: readonly AnyStoreDefinition[] }[];
}

/**
 * Owns adapter-scoped store instances for one adapter instance, and
 * resolves store definitions by id (adapter members first, then page
 * members, then the passed definition itself).
 *
 * Page-scoped instances live in page scopes, not here. Resolution
 * needs the same lookup, so it lives here too.
 */
export class StoreRegistry {
  private readonly adapterStores = new Map<string, AnyInstance>();

  /**
   * @param sources - Adapter-level and page-level store definitions
   * used for id resolution.
   */
  constructor(private readonly sources: ScopeSources) {}

  /**
   * Returns the adapter-scoped instance for a definition, creating it
   * on first use. Instances are shared for the adapter instance
   * lifetime.
   *
   * @param definition - The store definition.
   */
  adapterStore<
    TState extends Record<string, unknown>,
    TActions extends Record<string, (...args: never[]) => unknown>,
  >(
    definition: StoreDefinition<TState, TActions>,
  ): StoreInstance<TState, TActions> {
    const existing = this.adapterStores.get(definition.id);
    if (existing) return existing as unknown as StoreInstance<TState, TActions>;
    const created = createStoreInstance(definition);
    this.adapterStores.set(definition.id, created as unknown as AnyInstance);
    return created;
  }

  /**
   * Resolves a store definition to its canonical member: the adapter
   * member first, then the first page member with the same id, else
   * the passed definition unchanged.
   *
   * @param definition - The store reference to resolve.
   */
  resolve(definition: AnyStoreDefinition): AnyStoreDefinition {
    const fromAdapter = this.sources.stores.find((s) => s.id === definition.id);
    if (fromAdapter) return fromAdapter;
    for (const page of this.sources.pages) {
      const fromPage = page.stores.find((s) => s.id === definition.id);
      if (fromPage) return fromPage;
    }
    return definition;
  }

  /** Destroys every adapter-scoped instance. */
  dispose(): void {
    for (const instance of this.adapterStores.values()) instance.destroy();
    this.adapterStores.clear();
  }
}
