import type {
  StoreDefinition,
  StoreHelpers,
  StoreInstance,
  StorePersistenceProvider,
  StoreStatus,
} from "./types";

export interface CreateStoreInstanceOptions {
  readonly persistenceProvider?: StorePersistenceProvider;
}

/**
 * Creates an isolated store instance with its own state and subscriptions.
 * Used by the runtime per scope; adapter code receives instances rather
 * than creating them.
 *
 * @param definition - The store definition to instantiate.
 * @returns An independent instance starting from the initial state.
 *
 * @example
 * ```ts
 * const session = createStoreInstance(sessionStore);
 * session.actions.setWarehouse("ETL_WH");
 * session.get().warehouse; // "ETL_WH"
 * ```
 */
export function createStoreInstance<
  TState extends Record<string, unknown>,
  TActions extends Record<string, (...args: never[]) => unknown>,
>(
  definition: StoreDefinition<TState, TActions>,
  options: CreateStoreInstanceOptions = {},
): StoreInstance<TState, TActions> {
  let state: TState = { ...definition.initialState };
  const listeners = new Set<(state: Readonly<TState>) => void>();
  let destroyed = false;
  let dirty = false;
  let status: StoreStatus = "ready";
  let saveQueue = Promise.resolve();

  const persistence = definition.persistence;
  const persistenceKey =
    persistence.type === "persistent" ? persistence.key : undefined;
  const persistenceRequest =
    persistence.type === "persistent"
      ? {
          scope: definition.scope,
          storeId: definition.id,
          key: persistenceKey ?? definition.id,
          version: persistence.version ?? 1,
        }
      : undefined;

  let resolveReady!: () => void;
  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const snapshot = (): Readonly<TState> => ({ ...state });

  const notify = (): void => {
    const current = snapshot();
    for (const listener of [...listeners]) listener(current);
  };

  const save = (): void => {
    if (!options.persistenceProvider || !persistenceRequest || destroyed)
      return;
    const value = snapshot();
    saveQueue = saveQueue
      .then(() =>
        options.persistenceProvider?.save({ ...persistenceRequest, value }),
      )
      .catch(() => {
        status = "error";
      });
  };

  const hydrate = async (): Promise<void> => {
    if (!persistenceRequest) return;
    if (!options.persistenceProvider) {
      status = "error";
      resolveReady();
      return;
    }
    status = "loading";
    try {
      const persisted =
        await options.persistenceProvider.load(persistenceRequest);
      if (!dirty && persisted) {
        if (!isStateRecord(persisted.value))
          throw new Error(
            `Invalid persisted state for store "${definition.id}"`,
          );
        state = { ...definition.initialState, ...persisted.value } as TState;
        notify();
      }
      status = "ready";
      if (dirty) save();
    } catch {
      status = "error";
    } finally {
      resolveReady();
    }
  };

  const helpers: StoreHelpers<TState> = {
    get: () => snapshot(),
    set: (patch) => {
      if (destroyed) return;
      dirty = true;
      state = { ...state, ...patch };
      notify();
      if (status === "ready") save();
    },
    reset: () => {
      if (destroyed) return;
      dirty = true;
      state = { ...definition.initialState };
      notify();
      if (status === "ready") save();
    },
  };

  if (persistenceRequest) void hydrate().catch(() => undefined);
  else resolveReady();

  return {
    definition,
    get status() {
      return status;
    },
    ready: () => readyPromise,
    flush: async () => {
      // A mutation can happen while the persistent store is still loading.
      // Hydration schedules that dirty state for persistence, so callers must
      // wait for both phases before the runtime disposes the instance.
      await readyPromise;
      await saveQueue;
    },
    get: () => snapshot(),
    set: (patch) => helpers.set(patch),
    reset: () => helpers.reset(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    actions: definition.createActions(helpers),
    destroy: () => {
      destroyed = true;
      listeners.clear();
    },
  };
}

function isStateRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
