import type { StoreDefinition, StoreHelpers, StoreInstance } from "./types";

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
): StoreInstance<TState, TActions> {
  let state: TState = { ...definition.initialState };
  const listeners = new Set<(state: Readonly<TState>) => void>();
  let destroyed = false;

  const snapshot = (): Readonly<TState> => ({ ...state });

  const notify = (): void => {
    const current = snapshot();
    for (const listener of [...listeners]) listener(current);
  };

  const helpers: StoreHelpers<TState> = {
    get: () => snapshot(),
    set: (patch) => {
      if (destroyed) return;
      state = { ...state, ...patch };
      notify();
    },
    reset: () => {
      if (destroyed) return;
      state = { ...definition.initialState };
      notify();
    },
  };

  return {
    definition,
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
