import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { PluginServiceProbe } from "@northgraindata/dsui-plugin-sdk";
import { Hono } from "hono";
import { type AdapterLoadOptions, loadAdapter } from "./adapters/loader.js";
import { AdapterRegistry } from "./adapters/registry.js";
import type { AdapterReadiness, LoadedAdapter } from "./adapters/types.js";
import {
  type AdapterSource,
  type DsuiConfig,
  isAdapterSource,
  loadConfig,
  toAdapterSourceLocation,
} from "./config.js";
import { ConnectionCipher, resolveMasterKey } from "./db/crypto.js";
import { DsuiDatabase } from "./db/database.js";
import { SqliteStorePersistenceProvider } from "./db/store-persistence.js";
import { registerEventRoutes } from "./events/routes.js";
import { SignalBus } from "./events/signal-bus.js";
import type { PluginFetch } from "./plugins/build.js";
import { PluginJobService } from "./plugins/job-service.js";
import { registerPluginRoutes } from "./plugins/routes.js";
import { type PluginModuleLoader, PluginRuntime } from "./plugins/runtime.js";
import { createPluginStorage, createPluginStores } from "./plugins/storage.js";
import { registerAdapterRoutes } from "./routes/adapters.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerExecuteRoutes } from "./routes/execute.js";
import {
  connectionFor,
  registerServiceRoutes,
  serviceSource,
} from "./routes/services.js";
import { registerSystemRoutes } from "./routes/system.js";

export type Runtime = ReturnType<typeof createRuntime>;

/** Upper bound on a plugin-triggered health probe. */
const DEFAULT_PROBE_TIMEOUT_MS = 5_000;

export type CreateRuntimeOptions = {
  dataDir?: string;
  databasePath?: string;
  configPath?: string;
  config?: DsuiConfig;
  masterKey?: string;
  /** Store for verified community-adapter artifacts. Defaults to <dataDir>. */
  adaptersDataDir?: string;
  /** Static web bundle root. Defaults to DSUI_WEB_ROOT. */
  webRoot?: string;
  /** Never open the network; require cached community adapters. */
  offlineAdapters?: boolean;
  /** Injectable fetch used by the community-adapter installer. */
  adapterFetch?: AdapterLoadOptions["fetch"];
  /**
   * Subprocess host factory for verified community adapters. Defaults to
   * re-entering this executable in adapter-host mode. Tests inject fakes.
   */
  spawnHost?: AdapterLoadOptions["spawnHost"];
  /** Loader for trusted, already-installed plugin packages. Tests inject fakes. */
  pluginModuleLoader?: PluginModuleLoader;
  pluginFetch?: PluginFetch;
  offlinePlugins?: boolean;
  /**
   * Called as each adapter starts and finishes loading, so a CLI can show
   * progress across what is otherwise a silent multi-second wait. Omitted by
   * library and test callers, which have no terminal to draw on.
   */
  onAdapterLoad?: (event: AdapterLoadEvent) => void;
};

/** One adapter beginning or finishing a load. */
export type AdapterLoadEvent =
  | { readonly phase: "start"; readonly id: string }
  | {
      readonly phase: "done";
      readonly id: string;
      readonly name: string;
      readonly ok: boolean;
      readonly ms: number;
      readonly detail?: string;
    };

/** Where DSUI keeps its own state, matching what the server would choose. */
export function defaultDataDir(): string {
  return (
    process.env.DSUI_DATA_DIR ??
    join(
      process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
      "dsui",
    )
  );
}

export function createRuntime(options: CreateRuntimeOptions = {}) {
  const dataDir = options.dataDir ?? defaultDataDir();
  const databasePath = options.databasePath ?? join(dataDir, "dsui.sqlite");
  const configPath =
    options.configPath ??
    process.env.DSUI_CONFIG ??
    (existsSync("/etc/dsui/dsui.yaml") ? "/etc/dsui/dsui.yaml" : undefined);
  const registry = new AdapterRegistry();
  const readiness = new Map<string, AdapterReadiness>();
  const database = new DsuiDatabase(databasePath);
  const signalBus = new SignalBus(database);
  const masterKey = resolveMasterKey(
    dataDir,
    options.masterKey ?? process.env.DSUI_MASTER_KEY,
  );
  const cipher = new ConnectionCipher(masterKey);
  let config = options.config ?? { services: [] };
  const listPluginServiceSummaries = () => {
    const configured = config.services.map((service) => {
      let name = service.name;
      if (!name) {
        try {
          name = registry.get(service.adapter).metadata.name;
        } catch {
          name = service.adapter;
        }
      }
      return {
        id: service.id,
        name,
        adapter: service.adapter,
        iconUrl: registry
          .list()
          .find((adapter) => adapter.id === service.adapter)?.metadata.iconUrl,
        managedBy: "configuration" as const,
      };
    });
    const uiManaged = database
      .listUiServices()
      .filter(
        (service) => !config.services.some((item) => item.id === service.id),
      )
      .map((service) => {
        let name = service.name;
        try {
          name ||= registry.get(service.adapter).metadata.name;
        } catch {
          name ||= service.adapter;
        }
        return {
          id: service.id,
          name,
          adapter: service.adapter,
          managedBy: "ui" as const,
          iconUrl: registry
            .list()
            .find((adapter) => adapter.id === service.adapter)?.metadata
            .iconUrl,
        };
      });
    return [...configured, ...uiManaged].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
  };
  const probePluginService = async (
    id: string,
    options?: { timeoutMs?: number },
  ): Promise<PluginServiceProbe | null> => {
    const source = serviceSource(config, database, id);
    if (!source) return null;
    let adapter: ReturnType<AdapterRegistry["get"]>;
    try {
      adapter = registry.get(source.service.adapter);
    } catch (error) {
      return {
        id,
        health: "unavailable",
        detail: error instanceof Error ? error.message : "Adapter unavailable",
      };
    }
    const timeoutMs = options?.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
    const probe = (async () =>
      adapter.backend.checkHealth(connectionFor(cipher, source), {
        persistenceNamespace: source.service.id,
      }))();
    // A plugin asks for health on a user-visible surface, so a hung
    // connection must not hold that request open indefinitely. The probe is
    // not cancelled: a late result is discarded rather than reported as a
    // failure the operator never observed.
    const timeout = new Promise<PluginServiceProbe>((resolve) =>
      setTimeout(
        () =>
          resolve({
            id,
            health: "unavailable",
            detail: `Health probe timed out after ${timeoutMs}ms`,
          }),
        timeoutMs,
      ).unref?.(),
    );
    void probe.catch(() => undefined);
    const result = await Promise.race([probe, timeout]);
    return "health" in result
      ? result
      : {
          id,
          health: result.status,
          ...(result.detail ? { detail: result.detail } : {}),
          ...(result.latencyMs !== undefined
            ? { latencyMs: result.latencyMs }
            : {}),
          ...(result.score !== undefined ? { score: result.score } : {}),
          ...(result.checks !== undefined ? { checks: result.checks } : {}),
        };
  };
  const pluginRuntime: PluginRuntime = new PluginRuntime(
    {
      list: async (input) => {
        const limit = input?.limit ?? 50;
        if (!Number.isInteger(limit) || limit < 1 || limit > 100)
          throw new Error(
            "Service catalog page size must be between 1 and 100",
          );
        const candidates = listPluginServiceSummaries().filter(
          (service) => !input?.cursor || service.id > input.cursor,
        );
        const remaining: ReturnType<typeof listPluginServiceSummaries> = [];
        for (const candidate of candidates)
          if (await pluginRuntime.canAccessService(candidate.id))
            remaining.push(candidate);
        const items = remaining.slice(0, limit);
        return {
          items,
          ...(remaining.length > limit ? { nextCursor: items.at(-1)?.id } : {}),
        };
      },
      get: async (id) =>
        (await pluginRuntime.canAccessService(id))
          ? (listPluginServiceSummaries().find(
              (service) => service.id === id,
            ) ?? null)
          : null,
      probe: async (id, probeOptions) =>
        (await pluginRuntime.canAccessService(id))
          ? probePluginService(id, probeOptions)
          : null,
    },
    options.pluginModuleLoader,
    { dataDir, fetch: options.pluginFetch, offline: options.offlinePlugins },
    {
      storage: (pluginId) => createPluginStorage(dataDir, pluginId),
      stores: (pluginId) => createPluginStores(database, pluginId),
      capabilities: (pluginId) => ({
        jobs: {
          enqueue: async (jobId, input) => ({
            runId: pluginJobs.enqueue(pluginId, jobId, input, undefined, true)
              .run.runId,
          }),
        },
        events: {
          read: async (options) => {
            const page = signalBus.read(options);
            const items: typeof page.items = [];
            for (const event of page.items) {
              if (
                event.serviceId
                  ? await pluginRuntime.canAccessService(event.serviceId)
                  : await pluginRuntime.canAccessGlobalEvents()
              )
                items.push(event);
            }
            return { ...page, items };
          },
          emit: async (signalId, payload, serviceId, type = "info") => {
            signalBus.publish({
              signalId: `${pluginId}.${signalId}`,
              type,
              sourceType: "plugin",
              sourceId: pluginId,
              serviceId,
              payload,
            });
          },
        },
      }),
    },
  );
  const registeredJobs = () => {
    const pluginJobs = pluginRuntime.jobs();
    const adapterJobs = listPluginServiceSummaries().flatMap((service) => {
      let adapter: ReturnType<AdapterRegistry["get"]>;
      try {
        adapter = registry.get(service.adapter);
      } catch {
        return [];
      }
      const source = serviceSource(config, database, service.id);
      if (!source) return [];
      return adapter.catalog.jobs.map((definition) => ({
        pluginId: `adapter:${service.id}`,
        job: {
          id: definition.id,
          ...(definition.schedule ? { schedule: definition.schedule } : {}),
          ...(definition.intervalMs !== undefined
            ? { intervalMs: definition.intervalMs }
            : {}),
          concurrency: definition.concurrency,
          timeoutMs: definition.timeoutMs,
          retry: definition.retry,
          invoke: async (
            input: unknown,
            context: {
              runId: string;
              signal: AbortSignal;
              logger: {
                info(message: string): void;
                warn(message: string): void;
                error(message: string): void;
              };
              reportSideEffect(): void;
            },
          ) => {
            const current = serviceSource(config, database, service.id);
            if (!current)
              throw new Error(`Adapter service "${service.id}" was removed`);
            const currentAdapter = registry.get(current.service.adapter);
            const emissions = await currentAdapter.backend.executeJob(
              definition.id,
              connectionFor(cipher, current),
              input,
              {
                runId: context.runId,
                signal: context.signal,
                timeoutMs: definition.timeoutMs,
              },
              { persistenceNamespace: service.id },
            );
            for (const emission of emissions) {
              const declared = currentAdapter.catalog.signals.find(
                (signal) => signal.id === emission.signalId,
              );
              if (!declared)
                throw new Error(
                  `Adapter job emitted undeclared signal "${emission.signalId}"`,
                );
              signalBus.publish({
                signalId: `${currentAdapter.id}.${emission.signalId}`,
                type: declared.type,
                sourceType: "adapter",
                sourceId: service.id,
                serviceId: service.id,
                payload: emission.payload,
                ...(emission.idempotencyKey
                  ? { idempotencyKey: emission.idempotencyKey }
                  : {}),
              });
            }
          },
        },
      }));
    });
    return [...pluginJobs, ...adapterJobs];
  };
  const pluginJobs = new PluginJobService(database, registeredJobs);
  const unsubscribeSignalJobs = signalBus.subscribe((event) => {
    for (const { pluginId, job } of pluginRuntime.jobs()) {
      if (!job.onSignals?.includes(event.signalId)) continue;
      try {
        pluginJobs.enqueue(pluginId, job.id, event, event.id);
      } catch (error) {
        console.error(
          `Could not enqueue plugin job "${pluginId}/${job.id}" for signal "${event.signalId}"`,
          error,
        );
      }
    }
  });
  let pluginsLoaded = false;
  let pluginSync: Promise<void> | undefined;
  let adapterSync: Promise<void> | undefined;
  let adaptersLoaded = false;
  let adapterSignature = "";
  const loaderOptions: AdapterLoadOptions = {
    dataDir: options.adaptersDataDir ?? dataDir,
    fetch: options.adapterFetch,
    offline: options.offlineAdapters,
    spawnHost: options.spawnHost,
    persistenceProvider: (namespace) =>
      new SqliteStorePersistenceProvider(database, namespace),
    persistenceDatabasePath: databasePath,
  };

  /**
   * Loads every configured adapter through the uniform loader and
   * records per-adapter readiness. One bad entry marks itself
   * unavailable instead of blocking startup; unknown override ids
   * are ignored by the registry. No `adapters:` section means no
   * adapters: nothing is implied, so every adapter needs an explicit
   * source in configuration.
   */
  /**
   * Builds every configured adapter, once.
   *
   * Each adapter is a `bun install`, two `bun build`s and a spawned host, so
   * re-running this per request cost seconds and, because `registry.reset`
   * empties the registry first, any request landing mid-rebuild failed with
   * "Unknown adapter". Concurrent callers await the same build, and once it has
   * succeeded the loaded adapters are kept unless the config's adapter set
   * changes.
   */
  const syncAdapters = async (loaded: DsuiConfig) => {
    if (adapterSync !== undefined) return adapterSync;
    const signature = JSON.stringify(Object.keys(loaded.adapters ?? {}).sort());
    if (adaptersLoaded && signature === adapterSignature) return;
    adapterSync = (async () => {
      const next: LoadedAdapter[] = [];
      readiness.clear();
      const entries = Object.entries(loaded.adapters ?? {});
      if (!entries.length)
        console.warn(
          `No adapters configured${configPath ? ` in ${configPath}` : ""}; DSUI starts with an empty adapter registry. Add an "adapters:" section to load any.`,
        );
      const sources: Array<[string, AdapterSource]> = entries.flatMap(
        ([id, entry]) => (isAdapterSource(entry) ? [[id, entry] as const] : []),
      );
      for (const [id, source] of sources) {
        options.onAdapterLoad?.({ phase: "start", id });
        const started = performance.now();
        try {
          const loadedAdapter = await loadAdapter(
            id,
            toAdapterSourceLocation(source, process.cwd()),
            loaderOptions,
          );
          next.push(loadedAdapter);
          readiness.set(id, {
            status: "ok",
            detail: `${loadedAdapter.metadata.name}`,
          });
          options.onAdapterLoad?.({
            phase: "done",
            id,
            name: loadedAdapter.metadata.name,
            ok: true,
            ms: performance.now() - started,
          });
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Load failed";
          // Reported through onAdapterLoad rather than logged here: a failed
          // adapter is a startup state the CLI already renders, and printing an
          // Error object also printed its stack.
          readiness.set(id, { status: "unavailable", detail });
          options.onAdapterLoad?.({
            phase: "done",
            id,
            name: id,
            ok: false,
            ms: performance.now() - started,
            detail,
          });
        }
      }
      // The previous registry is only replaced once every adapter has been
      // attempted, so a failed adapter leaves its working siblings in place
      // instead of clearing the registry and reporting them all as unknown.
      registry.reset(next);
      for (const [id, override] of Object.entries(loaded.adapters ?? {}))
        if (!isAdapterSource(override)) registry.applyMetadata(id, override);
      adapterSignature = signature;
      adaptersLoaded = true;
    })();
    try {
      await adapterSync;
    } finally {
      adapterSync = undefined;
    }
  };

  const syncPlugins = async (loaded: DsuiConfig) => {
    const sources = loaded.plugins ?? {};
    if (pluginsLoaded) return;
    if (pluginSync !== undefined) return pluginSync;
    pluginSync = pluginRuntime.load(sources);
    try {
      await pluginSync;
      await pluginJobs.start();
      pluginsLoaded = true;
    } finally {
      pluginSync = undefined;
    }
  };

  const refreshConfig = async () => {
    const loaded = options.config ?? (await loadConfig(configPath));
    const duplicates = loaded.services
      .filter((service) =>
        database.listUiServices().some((row) => row.id === service.id),
      )
      .map((service) => service.id);
    if (duplicates.length)
      throw new Error(
        `Service IDs are managed twice; remove them from one source: ${duplicates.join(", ")}`,
      );
    config = loaded;
    await syncAdapters(loaded);
    await syncPlugins(loaded);
    pluginJobs.refreshDefinitions();
    return config;
  };

  const getConfig = () => config;
  const audit = (
    actor: string,
    action: string,
    target: string,
    metadata: Record<string, unknown> = {},
  ): void => {
    database.audit(actor, action, target, metadata);
  };

  const app = new Hono();

  const serviceDeps = {
    registry,
    pluginRuntime,
    signalBus,
    pluginJobs,
    refreshJobs: () => pluginJobs.refreshDefinitions(),
    database,
    cipher,
    getConfig,
    refreshConfig,
    audit,
  };
  registerSystemRoutes(app, {
    pluginRuntime,
    webRoot: options.webRoot,
  });
  registerAuthRoutes(app, { pluginRuntime });
  registerPluginRoutes(app, { runtime: pluginRuntime, audit });
  registerEventRoutes(app, { bus: signalBus, runtime: pluginRuntime });
  registerAdapterRoutes(app, {
    registry,
    readiness: () => readiness,
  });
  registerServiceRoutes(app, serviceDeps);
  registerExecuteRoutes(app, serviceDeps);

  return {
    app,
    database,
    registry,
    pluginRuntime,
    pluginJobs,
    signalBus,
    refreshConfig,
    close: async () => {
      unsubscribeSignalJobs();
      await pluginJobs.close();
      await pluginRuntime.close();
      database.close();
    },
  };
}
