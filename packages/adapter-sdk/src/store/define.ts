import { assertNonEmptyId } from "../shared/validators";
import type { StoreDefinition, StoreHelpers, StoreScope } from "./types";

/**
 * Defines client/session/UI state.
 *
 * @param options.id - Unique within its scope, e.g. `"session"`.
 * @param options.scope - `"adapter"` (per adapter instance) or `"page"`
 * (per rendered page).
 * @param options.state - Initial state; copied per instance.
 * @param options.actions - Factory receiving `{ get, set, reset }` and
 * returning typed actions.
 * @returns A store definition; instances are created per scope by the runtime.
 * @throws {@link InvalidDefinitionError} for empty ids.
 *
 * @example
 * ```ts
 * export const sessionStore = defineStore({
 *   id: "session",
 *   scope: "adapter",
 *   state: { warehouse: null as string | null },
 *   actions: ({ set }) => ({
 *     setWarehouse: (warehouse: string | null) => set({ warehouse }),
 *   }),
 * });
 * ```
 */
export function defineStore<
  TState extends Record<string, unknown>,
  TActions extends Record<string, (...args: never[]) => unknown>,
>(options: {
  id: string;
  scope: StoreScope;
  state: TState;
  actions: (helpers: StoreHelpers<TState>) => TActions;
}): StoreDefinition<TState, TActions> {
  assertNonEmptyId("Store", options.id);
  return {
    kind: "store",
    id: options.id,
    scope: options.scope,
    initialState: { ...options.state },
    createActions: options.actions,
  };
}
