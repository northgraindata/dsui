import type { AnyPageDefinition, StoreAccessor } from "../page/index";
import {
  createStoreInstance,
  type StoreDefinition,
  type StoreInstance,
} from "../store/index";
import type { StoreRegistry } from "./store-registry";
import type { PageScope } from "./types";

type AnyStoreInstance = StoreInstance<
  Record<string, unknown>,
  Record<string, (...args: never[]) => unknown>
>;

/**
 * Creates a rendered page scope: resolves the page's stores, renders
 * the component tree, and notifies listeners on store changes.
 *
 * Adapter-scoped stores are shared via the registry; page-scoped
 * stores are created fresh and destroyed with the scope.
 *
 * @param registry - The instance store registry.
 * @param page - The page definition to render.
 * @param params - Decoded route params.
 */
export function createPageScope(
  registry: StoreRegistry,
  page: AnyPageDefinition,
  params: Record<string, string> = {},
): PageScope {
  const pageStores = new Map<string, AnyStoreInstance>();
  const listeners = new Set<() => void>();
  let scopeDisposed = false;

  const notifyScope = (): void => {
    if (scopeDisposed) return;
    for (const listener of [...listeners]) listener();
  };

  const accessor: StoreAccessor = {
    use(def) {
      const resolved = registry.resolve(def);
      if (resolved.scope === "adapter") {
        const adapterInstance = registry.adapterStore(
          def as StoreDefinition<
            Record<string, unknown>,
            Record<string, (...args: never[]) => unknown>
          >,
        );
        adapterInstance.subscribe(() => notifyScope());
        return liveView(adapterInstance) as never;
      }
      let pageInstance = pageStores.get(def.id);
      if (!pageInstance) {
        pageInstance = createStoreInstance(
          resolved as StoreDefinition<
            Record<string, unknown>,
            Record<string, (...args: never[]) => unknown>
          >,
        );
        pageStores.set(def.id, pageInstance);
      }
      const current = pageInstance;
      current.subscribe(() => notifyScope());
      return liveView(current) as never;
    },
    get(def) {
      const resolved = registry.resolve(def);
      if (resolved.scope === "adapter")
        return {
          ...registry
            .adapterStore(
              def as StoreDefinition<
                Record<string, unknown>,
                Record<string, (...args: never[]) => unknown>
              >,
            )
            .get(),
        } as never;
      const existing = pageStores.get(def.id);
      if (existing) return { ...existing.get() } as never;
      const created = createStoreInstance(
        resolved as StoreDefinition<
          Record<string, unknown>,
          Record<string, (...args: never[]) => unknown>
        >,
      );
      pageStores.set(def.id, created);
      return { ...created.get() } as never;
    },
  };

  return {
    page,
    params: { ...params },
    stores: accessor,
    render: () => page.render({ params: { ...params }, stores: accessor }),
    onUpdate: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      scopeDisposed = true;
      listeners.clear();
      for (const instance of pageStores.values()) instance.destroy();
      pageStores.clear();
    },
  };
}

/**
 * Live view over a store instance: state fields as getters (always
 * current) merged with the instance's bound actions.
 */
function liveView(instance: AnyStoreInstance): Record<string, unknown> {
  const view: Record<string, unknown> = {};
  for (const key of Object.keys(instance.get())) {
    Object.defineProperty(view, key, {
      enumerable: true,
      get: () => instance.get()[key],
    });
  }
  return Object.assign(view, instance.actions);
}
