import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  DATASET_OBSERVE_MAX_REFS,
  type PluginDatasetOptions,
  PluginRequestError,
  type PluginServiceProbe,
} from "@northgraindata/dsui-plugin-sdk";
import { Hono } from "hono";
import { type AdapterLoadOptions, loadAdapter } from "./adapters/loader.js";
import { AdapterRegistry } from "./adapters/registry.js";
import type {
  AdapterBackend,
  AdapterReadiness,
  LoadedAdapter,
} from "./adapters/types.js";
import {
  type AdapterSource,
  type DsuiConfig,
  isAdapterSource,
  loadConfig,
  toAdapterSourceLocation,
} from "./config.js";
import { TunnelManager } from "./connectors/manager";
import { ConnectorProxy } from "./connectors/proxy";
import {
  createConnectorRouting,
  setConnectorRouting,
} from "./connectors/routing";
import { removeServiceBlobs } from "./db/blob-storage.js";
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
import { registerAdapterRouteEndpoints } from "./routes/adapter-routes.js";
import { registerAdapterRoutes } from "./routes/adapters.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerConnectorRoutes } from "./routes/connectors";
import { registerExecuteRoutes } from "./routes/execute.js";
import {
  connectionFor,
  executeServiceAction,
  queryServiceResource,
  registerServiceRoutes,
  serviceSource,
} from "./routes/services.js";
import { registerSettingsRoutes } from "./routes/settings";
import { registerSystemRoutes } from "./routes/system.js";
import { createErrorCounter } from "./telemetry/errors";

export type Runtime = ReturnType<typeof createRuntime>;

/** Upper bound on a plugin-triggered health probe. */
const DEFAULT_PROBE_TIMEOUT_MS = 5_000;
/**
 * A dataset read answers from the system's own catalog, so it is meant to be
 * quick; the ceiling stops a plugin holding a connection open on a slow system.
 */
const DEFAULT_DATASET_TIMEOUT_MS = 30_000;
const MAX_DATASET_TIMEOUT_MS = 60_000;

type DatasetBackend = Required<
  Pick<AdapterBackend, "listDatasets" | "observeDatasets">
>;

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

/** Spreads the acting person into a signal or action call, when there is one. */
function withActor(actor: string | undefined): { actor?: string } {
  return actor ? { actor } : {};
}

export function createRuntime(options: CreateRuntimeOptions = {}) {
  const dataDir = options.dataDir ?? defaultDataDir();
  const databasePath = options.databasePath ?? join(dataDir, "dsui.sqlite");
  const blobRoot = join(dataDir, "blobs");
  const configPath =
    options.configPath ??
    process.env.DSUI_CONFIG ??
    (existsSync("/etc/dsui/dsui.yaml") ? "/etc/dsui/dsui.yaml" : undefined);
  const errors = createErrorCounter();
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
  const capabilitiesOf = (adapterId: string): string[] =>
    registry.has(adapterId)
      ? [...(registry.get(adapterId).catalog.capabilities ?? [])]
      : [];
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
        adapterName: registry
          .list()
          .find((adapter) => adapter.id === service.adapter)?.metadata.name,
        iconUrl: registry
          .list()
          .find((adapter) => adapter.id === service.adapter)?.metadata.iconUrl,
        managedBy: "configuration" as const,
        capabilities: capabilitiesOf(service.adapter),
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
          adapterName: registry
            .list()
            .find((adapter) => adapter.id === service.adapter)?.metadata.name,
          managedBy: "ui" as const,
          capabilities: capabilitiesOf(service.adapter),
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
  const resolveDatasets = async (id: string) => {
    if (!(await pluginRuntime.canAccessService(id))) return null;
    const source = serviceSource(config, database, id);
    if (!source || !registry.has(source.service.adapter)) return null;
    const adapter = registry.get(source.service.adapter);
    const { listDatasets, observeDatasets } = adapter.backend;
    if (
      !adapter.catalog.capabilities?.includes("datasets") ||
      !listDatasets ||
      !observeDatasets
    )
      throw new PluginRequestError(
        "This service's adapter does not describe datasets",
        422,
      );
    return {
      source,
      backend: adapter.backend as DatasetBackend & AdapterBackend,
    };
  };
  const datasetCallOptions = (options?: PluginDatasetOptions) => ({
    ...(options?.signal ? { signal: options.signal } : {}),
    timeoutMs: Math.min(
      Math.max(options?.timeoutMs ?? DEFAULT_DATASET_TIMEOUT_MS, 1),
      MAX_DATASET_TIMEOUT_MS,
    ),
  });
  /**
   * Runs one dataset read and rechecks access afterwards, as a resource read
   * does: a permission revoked while the adapter was answering must not hand
   * the result over.
   */
  const guardDatasetCall = async <T>(
    id: string,
    read: () => Promise<T>,
  ): Promise<T> => {
    let result: T;
    try {
      result = await read();
    } catch (error) {
      if (error instanceof PluginRequestError) throw error;
      throw new PluginRequestError(
        error instanceof Error ? error.message : "Dataset read failed",
        422,
      );
    }
    if (!(await pluginRuntime.canAccessService(id)))
      throw new Error("Service permission was revoked during the dataset read");
    return result;
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
      executeAction: async (id, actionId, input, options) => {
        await pluginRuntime.requireServiceAccess(id, "execute", {
          actionId,
          actionInput: input,
        });
        const result = await executeServiceAction(
          {
            registry,
            database,
            cipher,
            getConfig: () => config,
            refreshConfig,
            signalBus,
            audit: (actor, action, target, metadata) =>
              database.audit(actor, action, target, metadata),
          },
          id,
          actionId,
          input,
          options?.signal
            ? AbortSignal.any([options.signal, AbortSignal.timeout(600000)])
            : AbortSignal.timeout(600000),
          options?.origin?.pluginId ?? "plugin",
          {
            origin: options?.origin,
            ...withActor(pluginRuntime.actingPrincipalId()),
          },
        );
        if (result.result.status === "error")
          throw new PluginRequestError(result.result.message, 422);
        return result.result.data;
      },
      signals: async (id) => {
        if (!(await pluginRuntime.canAccessService(id))) return null;
        const source = serviceSource(config, database, id);
        if (!source) return null;
        if (!registry.has(source.service.adapter)) return null;
        const adapter = registry.get(source.service.adapter);
        return adapter.catalog.signals.map((signal) => ({
          id: `${adapter.id}.${signal.id}`,
          type: signal.type,
        }));
      },
      listResources: async (id) => {
        if (!(await pluginRuntime.canAccessService(id))) return null;
        const source = serviceSource(config, database, id);
        if (!source) return null;
        return registry
          .get(source.service.adapter)
          .catalog.resources.map(({ id, inputSchema, description }) => ({
            id,
            ...(description !== undefined ? { description } : {}),
            ...(inputSchema ? { inputSchema } : {}),
          }));
      },
      listActions: async (id) => {
        if (!(await pluginRuntime.canAccessService(id))) return null;
        const source = serviceSource(config, database, id);
        if (!source) return null;
        return registry
          .get(source.service.adapter)
          .catalog.actions.map(({ id, inputSchema, description }) => ({
            id,
            ...(description !== undefined ? { description } : {}),
            ...(inputSchema ? { inputSchema } : {}),
          }));
      },
      queryResource: async (id, resourceId, input) => {
        if (!(await pluginRuntime.canAccessService(id)))
          throw new Error("Insufficient service permission");
        const result = await queryServiceResource(
          {
            registry,
            database,
            cipher,
            getConfig: () => config,
            refreshConfig,
          },
          id,
          resourceId,
          input,
        );
        if (!(await pluginRuntime.canAccessService(id)))
          throw new Error(
            "Service permission was revoked during the resource read",
          );
        return result.data;
      },
      probe: async (id, probeOptions) =>
        (await pluginRuntime.canAccessService(id))
          ? probePluginService(id, probeOptions)
          : null,
      datasets: {
        list: async (id, input, datasetOptions) => {
          const target = await resolveDatasets(id);
          if (!target) return null;
          const page = await guardDatasetCall(id, () =>
            target.backend.listDatasets(
              connectionFor(cipher, target.source),
              {
                ...(input?.cursor !== undefined
                  ? { cursor: input.cursor }
                  : {}),
                limit: input?.limit ?? 500,
              },
              datasetCallOptions(datasetOptions),
              { persistenceNamespace: target.source.service.id },
            ),
          );
          return page;
        },
        observe: async (id, refs, datasetOptions) => {
          const target = await resolveDatasets(id);
          if (!target) return null;
          if (refs.length > DATASET_OBSERVE_MAX_REFS)
            throw new PluginRequestError(
              `At most ${DATASET_OBSERVE_MAX_REFS} datasets can be observed at once`,
              422,
            );
          if (!refs.length) return [];
          return guardDatasetCall(id, () =>
            target.backend.observeDatasets(
              connectionFor(cipher, target.source),
              refs,
              datasetCallOptions(datasetOptions),
              { persistenceNamespace: target.source.service.id },
            ),
          );
        },
      },
    },
    options.pluginModuleLoader,
    { dataDir, fetch: options.pluginFetch, offline: options.offlinePlugins },
    {
      storage: (pluginId) => createPluginStorage(dataDir, pluginId),
      stores: (pluginId) => createPluginStores(database, pluginId),
      plugins: () => pluginRuntime.pluginCapabilities(),
      audit: (actor, action, target) => database.audit(actor, action, target),
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
              ...withActor(pluginRuntime.actingPrincipalId()),
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
  const loadedSources = new Map<string, string>();
  const stagedBuilds = new Map<LoadedAdapter["backend"], string>();
  const sourceMetadata = new Map<string, LoadedAdapter["metadata"]>();
  const removeStagedBuild = async (directory: string) => {
    await rm(directory, { recursive: true, force: true }).catch((error) => {
      console.warn("Could not remove retired adapter build", error);
    });
  };
  const retireAdapter = async (
    backend: LoadedAdapter["backend"],
    drain: boolean,
  ) => {
    await backend.close?.(drain);
    const directory = stagedBuilds.get(backend);
    if (directory) {
      await removeStagedBuild(directory);
      stagedBuilds.delete(backend);
    }
  };
  const retiringAdapters = new Set<Promise<unknown>>();
  const loaderOptions: AdapterLoadOptions = {
    dataDir: options.adaptersDataDir ?? dataDir,
    fetch: options.adapterFetch,
    offline: options.offlineAdapters,
    spawnHost: options.spawnHost,
    persistenceProvider: (namespace) =>
      new SqliteStorePersistenceProvider(database, namespace),
    persistenceDatabasePath: databasePath,
    persistenceBlobRoot: blobRoot,
  };

  /** Stage changed adapters before replacing any live registry entries. */
  const syncAdapters = async (loaded: DsuiConfig) => {
    if (adapterSync !== undefined) return adapterSync;
    const signature = JSON.stringify(
      Object.entries(loaded.adapters ?? {}).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
    if (adaptersLoaded && signature === adapterSignature) return;
    adapterSync = (async () => {
      if (!adaptersLoaded)
        await removeStagedBuild(
          join(loaderOptions.dataDir ?? dataDir, "adapters", "staged"),
        );
      const next: LoadedAdapter[] = [];
      const previous = new Map(
        registry.list().map((adapter) => [adapter.id, adapter]),
      );
      for (const id of readiness.keys()) {
        const entry = loaded.adapters?.[id];
        if (!entry || !isAdapterSource(entry)) readiness.delete(id);
      }
      const entries = Object.entries(loaded.adapters ?? {});
      if (!entries.length)
        console.warn(
          `No adapters configured${configPath ? ` in ${configPath}` : ""}; DSUI starts with an empty adapter registry. Add an "adapters:" section to load any.`,
        );
      const sources: Array<[string, AdapterSource]> = entries.flatMap(
        ([id, entry]) => (isAdapterSource(entry) ? [[id, entry] as const] : []),
      );
      for (const [id, source] of sources) {
        const old = previous.get(id);
        const sourceSignature = JSON.stringify(source);
        const metadata = sourceMetadata.get(id);
        const retained = old && metadata ? { ...old, metadata } : old;
        if (retained && loadedSources.get(id) === sourceSignature) {
          next.push(retained);
          continue;
        }
        let buildDirectory: string | undefined;
        options.onAdapterLoad?.({ phase: "start", id });
        const started = performance.now();
        try {
          if (adaptersLoaded && !loaderOptions.offline) {
            const root = join(
              loaderOptions.dataDir ?? dataDir,
              "adapters",
              "staged",
            );
            await mkdir(root, { recursive: true });
            buildDirectory = await mkdtemp(join(root, "build-"));
          }
          const loadedAdapter = await loadAdapter(
            id,
            toAdapterSourceLocation(source, process.cwd()),
            { ...loaderOptions, buildDirectory },
          );
          if (buildDirectory)
            stagedBuilds.set(loadedAdapter.backend, buildDirectory);
          loadedSources.set(id, sourceSignature);
          sourceMetadata.set(id, loadedAdapter.metadata);
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
          if (buildDirectory) await removeStagedBuild(buildDirectory);
          if (retained) next.push(retained);
          errors.record("adapter_load_failed", id);
          const detail = error instanceof Error ? error.message : "Load failed";
          // Reported through onAdapterLoad rather than logged here: a failed
          // adapter is a startup state the CLI already renders, and printing an
          // Error object also printed its stack.
          readiness.set(id, {
            status: retained ? "ok" : "unavailable",
            detail: retained
              ? `Still serving the previous build: ${detail}`
              : detail,
          });
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
      const activeBackends = new Set(next.map((adapter) => adapter.backend));
      registry.reset(next);
      for (const id of previous.keys()) {
        if (!registry.has(id)) {
          loadedSources.delete(id);
          sourceMetadata.delete(id);
        }
      }
      for (const { backend } of previous.values()) {
        if (activeBackends.has(backend)) continue;
        const retirement = retireAdapter(backend, true)
          .catch((error) => console.warn("Could not retire adapter", error))
          .finally(() => retiringAdapters.delete(retirement));
        retiringAdapters.add(retirement);
      }
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
    const previousConfig = config;
    config = loaded;
    await Promise.all(
      previousConfig.services.map(async (service) => {
        const next = loaded.services.find((entry) => entry.id === service.id);
        if (
          !next ||
          next.adapter !== service.adapter ||
          JSON.stringify(next.connection) !== JSON.stringify(service.connection)
        )
          await registry
            .list()
            .find((adapter) => adapter.id === service.adapter)
            ?.backend.invalidateService?.(service.id);
      }),
    );
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

  // Counts failed actions and resource reads by built-in adapter, for
  // telemetry. A refusal (4xx) is the server working as designed, not a fault.
  app.use("/api/v1/services/:id/*", async (context, next) => {
    await next();
    if (context.res.status < 500) return;
    const category = context.req.path.includes("/actions/")
      ? "action_failed"
      : context.req.path.includes("/resources/")
        ? "resource_query_failed"
        : undefined;
    if (!category) return;
    errors.record(
      category,
      serviceSource(config, database, context.req.param("id"))?.service.adapter,
    );
  });
  app.onError((error, context) => {
    errors.record("unhandled_error");
    console.error(error);
    return context.text("Internal Server Error", 500);
  });

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
    removeServiceData: (serviceId: string) =>
      removeServiceBlobs(blobRoot, serviceId),
  };
  registerSystemRoutes(app, {
    pluginRuntime,
    webRoot: options.webRoot,
  });
  registerAuthRoutes(app, { pluginRuntime });
  registerSettingsRoutes(app, {
    database,
    runtime: pluginRuntime,
    getConfig,
    registry,
    readiness: () => readiness,
    dataDir,
    configPath,
  });
  registerPluginRoutes(app, { runtime: pluginRuntime, audit });
  registerEventRoutes(app, { bus: signalBus, runtime: pluginRuntime });
  registerAdapterRoutes(app, {
    registry,
    readiness: () => readiness,
  });
  // DSUI agents: customer-side connectors that carry traffic into private networks.
  const tunnel = new TunnelManager({
    database,
    trustProxyHeaders: process.env.DSUI_TRUST_PROXY === "1",
  });
  const connectorProxy = new ConnectorProxy(tunnel);
  registerConnectorRoutes(app, {
    database,
    cipher,
    tunnel,
    pluginRuntime,
    audit,
  });
  registerServiceRoutes(app, serviceDeps);
  registerExecuteRoutes(app, serviceDeps);
  registerAdapterRouteEndpoints(app, {
    ...serviceDeps,
    spoolDirectory: join(dataDir, "tmp", "route-bodies"),
  });

  return {
    app,
    errors,
    database,
    registry,
    pluginRuntime,
    pluginJobs,
    signalBus,
    refreshConfig,
    tunnel,
    /** Starts the loopback proxy that routes services through DSUI agents. */
    startConnectors: async () => {
      await connectorProxy.start();
      setConnectorRouting(createConnectorRouting(database, connectorProxy));
    },
    close: async () => {
      tunnel.close();
      setConnectorRouting(undefined);
      await connectorProxy.close();
      unsubscribeSignalJobs();
      await pluginJobs.close();
      await pluginRuntime.close();
      await adapterSync;
      await Promise.all([
        ...retiringAdapters,
        ...registry.list().map(({ backend }) => retireAdapter(backend, false)),
      ]);
      database.close();
    },
  };
}
