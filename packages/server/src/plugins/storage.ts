import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  assertDatabaseName,
  createPluginStore,
  type PluginStorage,
  type PluginStoreDefinition,
  type PluginStoreInstance,
  type PluginStorePersistenceRequest,
  type PluginStores,
} from "@northgraindata/dsui-plugin-sdk";
import type { DsuiDatabase } from "../db/database.js";

export type PluginStorageHandle = PluginStorage & {
  /** Closes every database this plugin opened. */
  close(): void;
};

/**
 * Per-plugin storage rooted in one directory the plugin cannot leave.
 *
 * Each plugin gets `<dataDir>/plugins/<pluginId>/`. The host creates that
 * directory and hands back a handle for a file inside it; it never reads the
 * schema and never resolves a path the plugin did not name. That containment is
 * the point: an auth plugin holds users, sessions and grants here, and the host
 * has no migration or table that mentions them.
 *
 * The directory is created `0700` on first use, not eagerly, because it holds
 * credential material for the auth plugins that will be its main tenant — and
 * because a plugin that never opens a database should leave nothing behind.
 */
export function createPluginStorage(
  dataDir: string,
  pluginId: string,
): PluginStorageHandle {
  const pluginDir = join(dataDir, "plugins", pluginId);
  const opened = new Map<string, Database>();
  let ensured = false;
  return {
    directory() {
      mkdirSync(pluginDir, { recursive: true, mode: 0o700 });
      return pluginDir;
    },
    openDatabase(name) {
      assertDatabaseName(name);
      const existing = opened.get(name);
      if (existing) return existing;
      if (!ensured) {
        mkdirSync(pluginDir, { recursive: true, mode: 0o700 });
        ensured = true;
      }
      const database = new Database(join(pluginDir, `${name}.sqlite`), {
        create: true,
      });
      database.exec(
        "PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;",
      );
      opened.set(name, database);
      return database;
    },
    close() {
      for (const database of opened.values()) {
        try {
          database.close();
        } catch {
          // A database the plugin already closed is not a stop failure; the
          // plugin is going away either way.
        }
      }
      opened.clear();
    },
  };
}

/**
 * Store instances for one plugin, namespaced to it.
 *
 * Reuses the host's `store_state` table with the plugin id as the namespace, so
 * plugin state costs no new migration and two plugins cannot collide on a
 * store id.
 */
export function createPluginStores(
  database: DsuiDatabase,
  pluginId: string,
): PluginStores {
  // One instance per definition, cached. A plugin reaches its stores both from
  // `start` and from a resource query, and each call used to build a fresh
  // instance that re-read the row: the sampler's writes were then overwritten
  // by whatever the next reader had loaded, leaving a single point behind.
  const instances = new Map<string, unknown>();
  const instanceFor = <
    TState extends Record<string, unknown>,
    TActions extends Record<string, (...args: never[]) => unknown>,
  >(
    definition: PluginStoreDefinition<TState, TActions>,
  ): PluginStoreInstance<TState, TActions> => {
    const key = `${definition.id}:${
      (definition.persistence as { key?: string }).key ?? definition.id
    }`;
    const existing = instances.get(key) as
      | PluginStoreInstance<TState, TActions>
      | undefined;
    if (existing) return existing;
    const created = createStore(definition);
    instances.set(key, created);
    return created;
  };
  const stores: PluginStores = {
    get: (definition) => instanceFor(definition),
    create<
      TState extends Record<string, unknown>,
      TActions extends Record<string, (...args: never[]) => unknown>,
    >(
      definition: PluginStoreDefinition<TState, TActions>,
    ): PluginStoreInstance<TState, TActions> {
      return instanceFor(definition);
    },
  };
  const createStore = <
    TState extends Record<string, unknown>,
    TActions extends Record<string, (...args: never[]) => unknown>,
  >(
    definition: PluginStoreDefinition<TState, TActions>,
  ): PluginStoreInstance<TState, TActions> =>
    createPluginStore(definition, {
      persistenceProvider: {
        load: (request: PluginStorePersistenceRequest) =>
          Promise.resolve(
            database.loadStoreState(pluginId, {
              scope: "plugin",
              storeId: request.storeId,
              key: request.key,
              version: request.version,
            }),
          ),
        save: (request) => {
          database.saveStoreState(pluginId, {
            scope: "plugin",
            storeId: request.storeId,
            key: request.key,
            version: request.version,
            value: request.value,
          });
          return Promise.resolve();
        },
      },
    });
  return stores;
}

/**
 * Store instances with no durable backing.
 *
 * The default when a runtime is constructed without host capabilities, which is
 * how unit tests build one. A `persistent` store still works; it simply does
 * not survive the process.
 */
export function createMemoryPluginStores(): PluginStores {
  const saved = new Map<string, unknown>();
  // Cached per definition, for the same reason the database-backed factory
  // caches: a fresh instance per call re-reads its backing row and discards
  // anything a writer had appended since.
  const instances = new Map<string, unknown>();
  const instanceFor = <
    TState extends Record<string, unknown>,
    TActions extends Record<string, (...args: never[]) => unknown>,
  >(
    definition: PluginStoreDefinition<TState, TActions>,
  ): PluginStoreInstance<TState, TActions> => {
    const key = `${definition.id}:${
      (definition.persistence as { key?: string }).key ?? definition.id
    }`;
    const existing = instances.get(key) as
      | PluginStoreInstance<TState, TActions>
      | undefined;
    if (existing) return existing;
    const created = createPluginStore(definition, {
      persistenceProvider: {
        load: (request) =>
          Promise.resolve(
            saved.has(`${request.storeId}:${request.key}`)
              ? {
                  value: saved.get(`${request.storeId}:${request.key}`),
                  version: request.version,
                }
              : null,
          ),
        save: (request) => {
          saved.set(`${request.storeId}:${request.key}`, request.value);
          return Promise.resolve();
        },
      },
    });
    instances.set(key, created);
    return created;
  };
  const stores: PluginStores = {
    get: (definition) => instanceFor(definition),
    create<
      TState extends Record<string, unknown>,
      TActions extends Record<string, (...args: never[]) => unknown>,
    >(
      definition: PluginStoreDefinition<TState, TActions>,
    ): PluginStoreInstance<TState, TActions> {
      return instanceFor(definition);
    },
  };
  return stores;
}
