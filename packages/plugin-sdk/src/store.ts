/**
 * Plugin state storage.
 *
 * Two tiers, because a plugin needs two genuinely different things and the
 * adapter store layer only covers one of them.
 *
 * {@link defineStore} is the adapter pattern: typed, JSON-shaped state with
 * actions and subscriptions, persisted as one value per store. That is the
 * right shape for plugin UI state — the selected team, a dismissed notice.
 *
 * {@link PluginStorage} is the tier auth needs. Users, sessions and per-team
 * service grants are relational and queried, not read as one blob, so a
 * key-value store cannot hold them. A plugin opens a SQLite file in its own
 * directory and owns its schema.
 *
 * Both tiers keep a plugin inside its own folder. The host creates the
 * directory and hands back a handle; it never reads what is stored and never
 * gives a plugin a path it did not choose.
 */

import type { Database } from "bun:sqlite";

/** Where a store's state lives. */
export type PluginStorePersistence =
  | { readonly type: "memory" }
  | {
      readonly type: "persistent";
      readonly key?: string;
      readonly version?: number;
    };

export type PluginStoreStatus = "ready" | "loading" | "error";

/** Request passed to the host persistence provider. */
export interface PluginStorePersistenceRequest {
  readonly storeId: string;
  readonly key: string;
  readonly version: number;
}

/**
 * Host-side persistence backend.
 *
 * Mirrors the adapter SDK's provider so both tiers share one implementation
 * shape. The host namespaces each plugin's rows, so two plugins may use the
 * same store id without colliding.
 */
export interface PluginStorePersistenceProvider {
  load(
    request: PluginStorePersistenceRequest,
  ): Promise<{ readonly value: unknown; readonly version: number } | null>;
  save(
    request: PluginStorePersistenceRequest & { readonly value: unknown },
  ): Promise<void>;
}

/** State helpers handed to a store's `actions` factory. */
export interface PluginStoreHelpers<TState extends Record<string, unknown>> {
  get(): Readonly<TState>;
  set(patch: Partial<TState>): void;
  reset(): void;
}

export interface PluginStoreDefinition<
  TState extends Record<string, unknown>,
  TActions extends Record<string, (...args: never[]) => unknown>,
> {
  readonly kind: "plugin-store";
  readonly id: string;
  readonly persistence: PluginStorePersistence;
  readonly initialState: Readonly<TState>;
  readonly createActions: (helpers: PluginStoreHelpers<TState>) => TActions;
}

export interface PluginStoreInstance<
  TState extends Record<string, unknown>,
  TActions extends Record<string, (...args: never[]) => unknown>,
> {
  readonly definition: PluginStoreDefinition<TState, TActions>;
  readonly status: PluginStoreStatus;
  /** Resolves once the initial load finishes, successfully or not. */
  ready(): Promise<void>;
  /** Resolves once queued writes have landed. */
  flush(): Promise<void>;
  get(): Readonly<TState>;
  set(patch: Partial<TState>): void;
  reset(): void;
  subscribe(listener: (state: Readonly<TState>) => void): () => void;
  readonly actions: TActions;
  destroy(): void;
}

/**
 * Declares typed, persistable plugin state.
 *
 * The mirror of the adapter SDK's `defineStore`. `state` is copied per
 * instance, so two instances of one definition never share state.
 *
 * @example
 * ```ts
 * const session = defineStore({
 *   id: "session",
 *   persistence: { type: "persistent" },
 *   state: { teamId: null as string | null },
 *   actions: ({ set }) => ({ selectTeam: (teamId: string) => set({ teamId }) }),
 * });
 * ```
 */
export function defineStore<
  TState extends Record<string, unknown>,
  TActions extends Record<string, (...args: never[]) => unknown>,
>(options: {
  id: string;
  persistence?: PluginStorePersistence;
  state: TState;
  actions: (helpers: PluginStoreHelpers<TState>) => TActions;
}): PluginStoreDefinition<TState, TActions> {
  if (!options.id) throw new Error("Plugin store requires a non-empty id");
  return {
    kind: "plugin-store",
    id: options.id,
    persistence: options.persistence ?? { type: "memory" },
    initialState: { ...options.state },
    createActions: options.actions,
  };
}

/**
 * Relational storage scoped to one plugin.
 *
 * `openDatabase` resolves to a file inside the plugin's own directory, named by
 * the plugin. The host creates that directory and never inspects the schema,
 * so a plugin owns its tables and its migrations outright. This is what lets
 * an auth plugin hold users and sessions without the host schema knowing
 * anything about them.
 */
export interface PluginStorage {
  /**
   * Opens `<pluginDir>/<name>.sqlite`, creating it and its directory if
   * needed, and returns a handle the caller owns.
   *
   * @param name - File name without extension. Restricted to a plain name so a
   * plugin cannot traverse out of its own directory.
   */
  openDatabase(name: string): Database;
}

/** Rejects a database name that would escape the plugin's directory. */
export function assertDatabaseName(name: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(name))
    throw new Error(
      `Plugin database name must be a plain lowercase name; received "${name}"`,
    );
}

export interface CreatePluginStoreOptions {
  readonly persistenceProvider?: PluginStorePersistenceProvider;
}

/**
 * Instantiates a store definition against a host persistence provider.
 *
 * Mirrors the adapter SDK's `createStoreInstance`. A persistent store starts
 * from its initial state, hydrates in the background, and keeps the first
 * `set` that arrives before hydration so a mutation during load is not lost.
 */
export function createPluginStore<
  TState extends Record<string, unknown>,
  TActions extends Record<string, (...args: never[]) => unknown>,
>(
  definition: PluginStoreDefinition<TState, TActions>,
  options: CreatePluginStoreOptions = {},
): PluginStoreInstance<TState, TActions> {
  let state: TState = { ...definition.initialState };
  const listeners = new Set<(state: Readonly<TState>) => void>();
  let destroyed = false;
  let dirty = false;
  let status: PluginStoreStatus = "ready";
  let saveQueue = Promise.resolve();

  const persistence = definition.persistence;
  const persistenceRequest =
    persistence.type === "persistent"
      ? {
          storeId: definition.id,
          key: persistence.key ?? definition.id,
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

  const helpers: PluginStoreHelpers<TState> = {
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
      // A mutation can land while the store is still hydrating. Hydration
      // schedules that state for persistence, so callers wait for both phases.
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
