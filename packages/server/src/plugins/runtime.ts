import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type PageDocument,
  PLUGIN_API_VERSION,
  type PluginAuthenticationProvider,
  type PluginAuthorizationProvider,
  type PluginCatalog,
  type PluginNavigationItem,
  type PluginPermission,
  type PluginPrincipal,
  type PluginResource,
  type PluginServiceCatalog,
  type PluginServiceSummary,
  type PluginStores,
  type PreparedPlugin,
  type RuntimePluginAction,
  type RuntimePluginDefinition,
  type RuntimePluginJob,
  type RuntimePluginPage,
  type RuntimePluginProcedure,
  type RuntimePluginResource,
  type RuntimePluginSlot,
} from "@northgraindata/dsui-plugin-sdk";
import { resolveSdkRoot } from "../adapters/sdk.js";
import { allowed } from "../auth.js";
import type { PluginSource } from "../config.js";
import { buildPlugin, type PluginFetch } from "./build.js";
import { parseCron } from "./cron.js";
import {
  createMemoryPluginStores,
  createPluginStorage,
  type PluginStorageHandle,
} from "./storage.js";

const pluginIdPattern = /^[a-z][a-z0-9-]*$/;

export type PluginReadiness = {
  status: PluginCatalog["plugins"][number]["status"];
  detail?: string;
};

type RegisteredProcedure = RuntimePluginProcedure;

type ActivePlugin = {
  definition: RuntimePluginDefinition;
  browserPath?: string;
  browserSha256?: string;
};

type Contributions = {
  pages: RuntimePluginPage[];
  navigation: PluginNavigationItem[];
  slots: RuntimePluginSlot[];
  procedures: RegisteredProcedure[];
  /**
   * Declared actions, kept alongside procedures so a plugin that uses either
   * name resolves to the same runtime call. An action is a procedure; the two
   * collections differ only in which declaration produced them.
   */
  actions: RuntimePluginAction[];
  /**
   * Declared resources with their freshness policies. The host publishes the
   * policy so a browser can schedule polling without knowing whether it is
   * watching an adapter or a plugin.
   */
  resources: RuntimePluginResource[];
  /**
   * Declared durable jobs. Held until the plugin is active so a job only runs
   * once its own plugin has started; a job registered by a plugin that later
   * fails to load leaves nothing scheduled.
   */
  jobs: RuntimePluginJob[];
  authentication?: PluginAuthenticationProvider;
  authorization?: PluginAuthorizationProvider;
};

type PluginLoadRequest = {
  id: string;
  definition: RuntimePluginDefinition;
  prepared: PreparedPlugin;
  browserPath?: string;
  browserSha256?: string;
};

export type PluginModuleLoader = (specifier: string) => Promise<unknown>;

/**
 * Host-provided capabilities the runtime hands to each plugin.
 *
 * Passed in rather than built from the host database so the runtime stays
 * ignorant of host storage, and so a test can inject in-memory versions.
 */
export type PluginHostCapabilities = {
  /** Relational storage rooted in the plugin's own directory. */
  storage(pluginId: string): PluginStorageHandle;
  /** Typed JSON state, namespaced to the plugin. */
  stores(pluginId: string): PluginStores;
};

function resolveInstalledBundle(specifier: string): string {
  const bundled = bundledPluginPath(specifier);
  if (bundled) return bundled;
  if (isAbsolute(specifier)) return specifier;
  return requireFromWorkingDirectory.resolve(specifier);
}

/**
 * Resolves a plugin artifact from the bundled runtime directory.
 *
 * A release image and the npm package ship prebuilt plugin bundles in
 * `DSUI_RUNTIME_PLUGINS`, named `<plugin-id>-plugin.mjs` and
 * `<plugin-id>-plugin.browser.mjs`. Configuration names the package; this maps
 * it to the shipped artifact so a released install runs bundled code rather
 * than whatever node_modules happens to contain.
 */
function bundledPluginPath(specifier: string): string | undefined {
  const match =
    /^@northgraindata\/dsui-plugin-([a-z][a-z0-9-]*)(\/browser)?$/.exec(
      specifier,
    );
  const root = process.env.DSUI_RUNTIME_PLUGINS;
  if (!match || !root) return undefined;
  const path = join(
    root,
    `${match[1]}-plugin${match[2] ? ".browser" : ""}.mjs`,
  );
  return existsSync(path) ? path : undefined;
}

const requireFromWorkingDirectory = createRequire(
  resolve(process.cwd(), "package.json"),
);

async function loadInstalledPlugin(specifier: string): Promise<unknown> {
  const bundled = bundledPluginPath(specifier);
  if (bundled) return import(pathToFileURL(bundled).href);
  if (
    specifier.startsWith("/") ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("file:")
  ) {
    const resolvedPath = specifier.startsWith("file:")
      ? new URL(specifier)
      : pathToFileURL(resolve(process.cwd(), specifier));
    return import(resolvedPath.href);
  }
  try {
    const resolvedPath = requireFromWorkingDirectory.resolve(specifier);
    return import(pathToFileURL(resolvedPath).href);
  } catch {
    return import(specifier);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isRuntimePluginDefinition(
  value: unknown,
): value is RuntimePluginDefinition {
  if (!isRecord(value) || value.kind !== "dsui-plugin") return false;
  if (!isRecord(value.metadata) || !isRecord(value.configSchema)) return false;
  return (
    typeof value.metadata.id === "string" &&
    pluginIdPattern.test(value.metadata.id) &&
    typeof value.metadata.name === "string" &&
    typeof value.metadata.version === "string" &&
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.metadata.version) &&
    (value.metadata.security === undefined ||
      typeof value.metadata.security === "boolean") &&
    typeof value.metadata.apiVersion === "number" &&
    typeof value.configSchema.parse === "function" &&
    typeof value.prepare === "function" &&
    (value.requires === undefined ||
      (Array.isArray(value.requires) &&
        value.requires.every(
          (dependency) => typeof dependency === "string",
        ))) &&
    (value.stop === undefined || typeof value.stop === "function")
  );
}

function asPluginDefinition(
  value: unknown,
  source: string,
): RuntimePluginDefinition {
  const candidate = isRecord(value) ? value : undefined;
  const definition = candidate?.default ?? candidate?.plugin;
  if (!isRuntimePluginDefinition(definition))
    throw new Error(`Plugin package "${source}" has no default plugin export`);
  if (definition.metadata.apiVersion !== PLUGIN_API_VERSION)
    throw new Error(
      `Plugin "${definition.metadata.id}" requires API ${String(definition.metadata.apiVersion)}; host supports ${PLUGIN_API_VERSION}`,
    );
  return definition;
}

type PluginContextLogger = {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
};

function pluginLogger(pluginId: string): PluginContextLogger {
  return {
    info: (message, metadata) =>
      console.info(`[plugin:${pluginId}] ${message}`, metadata ?? {}),
    warn: (message, metadata) =>
      console.warn(`[plugin:${pluginId}] ${message}`, metadata ?? {}),
    error: (message, metadata) =>
      console.error(`[plugin:${pluginId}] ${message}`, metadata ?? {}),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function emptyContributions(): Contributions {
  return {
    pages: [],
    navigation: [],
    slots: [],
    procedures: [],
    actions: [],
    resources: [],
    jobs: [],
  };
}

function uniqueId<T extends { id: string }>(
  items: T[],
  item: T,
  kind: string,
  pluginId: string,
): void {
  if (!pluginIdPattern.test(item.id))
    throw new Error(`Plugin "${pluginId}" has invalid ${kind} id "${item.id}"`);
  if (items.some((existing) => existing.id === item.id))
    throw new Error(
      `Plugin "${pluginId}" has duplicate ${kind} id "${item.id}"`,
    );
  items.push(item);
}

function sortDependencies(
  requests: PluginLoadRequest[],
  readiness: Map<string, PluginReadiness>,
): PluginLoadRequest[] {
  const byId = new Map(requests.map((request) => [request.id, request]));
  const states = new Map<string, "visiting" | "visited">();
  const stack: string[] = [];
  const sorted: PluginLoadRequest[] = [];

  const visit = (request: PluginLoadRequest) => {
    if (states.get(request.id) === "visited") return;
    if (states.get(request.id) === "visiting") {
      const cycleStart = stack.indexOf(request.id);
      for (const id of stack.slice(cycleStart))
        readiness.set(id, {
          status: "unavailable",
          detail: "Plugin dependency cycle detected",
        });
      return;
    }
    states.set(request.id, "visiting");
    stack.push(request.id);
    for (const dependency of request.definition.requires ?? []) {
      const found = byId.get(dependency);
      if (!found) {
        readiness.set(request.id, {
          status: "unavailable",
          detail: `Required plugin "${dependency}" is disabled or unavailable`,
        });
        continue;
      }
      visit(found);
      if (readiness.get(dependency)?.status === "unavailable")
        readiness.set(request.id, {
          status: "unavailable",
          detail: `Required plugin "${dependency}" is unavailable`,
        });
    }
    stack.pop();
    states.set(request.id, "visited");
    if (readiness.get(request.id)?.status !== "unavailable")
      sorted.push(request);
  };

  for (const request of requests) visit(request);
  return sorted;
}

export class PluginRuntime {
  private readonly readiness = new Map<string, PluginReadiness>();
  private readonly active = new Map<string, ActivePlugin>();
  private readonly contributions = new Map<string, Contributions>();
  private readonly host: PluginHostCapabilities;
  private readonly pluginStorage = new Map<string, PluginStorageHandle>();
  private stopped = false;
  private securityFailure = false;
  private readonly principalContext = new AsyncLocalStorage<PluginPrincipal>();
  private authenticationProvider?: PluginAuthenticationProvider;
  private authorizationProvider?: PluginAuthorizationProvider;
  private authenticationPluginId_?: string;

  constructor(
    private readonly services: PluginServiceCatalog,
    private readonly loadModule: PluginModuleLoader = loadInstalledPlugin,
    private readonly sourceOptions: {
      dataDir?: string;
      fetch?: PluginFetch;
      offline?: boolean;
      /** Prepared SDK packages a source-built plugin links against. */
      sdkPackageRoot?: string;
    } = {},
    host?: PluginHostCapabilities,
  ) {
    const dataDir = sourceOptions.dataDir ?? process.cwd();
    this.host = host ?? {
      storage: (pluginId) => createPluginStorage(dataDir, pluginId),
      stores: () => createMemoryPluginStores(),
    };
  }

  async load(sources: Record<string, PluginSource>): Promise<void> {
    if (this.stopped) throw new Error("Plugin runtime is stopped");
    await this.stopActive();
    this.securityFailure = false;
    this.readiness.clear();
    this.contributions.clear();
    this.authenticationProvider = undefined;
    this.authenticationPluginId_ = undefined;
    this.authorizationProvider = undefined;

    // `sources` is the operator's configured plugin set, and the only one: a
    // plugin that is not configured does not run. This is what lets Pro,
    // Enterprise and third-party plugins all be enabled the same way, with no
    // host-side knowledge of which exist.
    const resolved = new Map<string, PluginSource>(Object.entries(sources));

    const requests: PluginLoadRequest[] = [];
    for (const [id, source] of resolved) {
      let securityPlugin = false;
      if (!pluginIdPattern.test(id)) {
        this.readiness.set(id, {
          status: "unavailable",
          detail: "Plugin id must be kebab-case",
        });
        continue;
      }
      if (!source.enabled) {
        this.readiness.set(id, { status: "disabled" });
        continue;
      }
      try {
        // A GitHub source is built from the tree, like a local one. The old
        // path fetched a prebuilt bundle from a pinned commit and verified an
        // SRI hash; that only ever worked for a plugin that had already been
        // built and published, which is exactly the case `buildPlugin` removes
        // the need for.
        const installed = undefined;
        // `package:` still resolves a shipped package; a source-built plugin
        // goes through the same pipeline an adapter uses, so a plugin with a
        // `dsui.browser` entry gets a real bundle instead of a hand-written one.
        const buildable =
          "source" in source &&
          (source.source === "local" || source.source === "git")
            ? source
            : undefined;
        const built = buildable
          ? await buildPlugin(
              id,
              buildable.source === "local"
                ? { kind: "local", path: buildable.path }
                : {
                    kind: "git",
                    repository: buildable.repository,
                    ref: buildable.ref ?? "main",
                    ...(buildable.path ? { path: buildable.path } : {}),
                  },
              {
                dataDir: this.sourceOptions.dataDir ?? process.cwd(),
                ...("token" in buildable && buildable.token
                  ? { githubToken: buildable.token }
                  : {}),
                // A source-built plugin links against the prepared SDK the
                // same way an adapter does, so both resolve the same
                // workspace packages instead of two copies.
                sdkPackageRoot:
                  this.sourceOptions.sdkPackageRoot ??
                  (await resolveSdkRoot({
                    dataDir: this.sourceOptions.dataDir ?? process.cwd(),
                    version: process.env.DSUI_VERSION ?? "0.0.0",
                  })),
                ...(this.sourceOptions.fetch
                  ? { fetch: this.sourceOptions.fetch }
                  : {}),
                ...(this.sourceOptions.offline
                  ? { offline: this.sourceOptions.offline }
                  : {}),
              },
            )
          : undefined;
        const module = await this.loadModule(
          built?.bundlePath ?? ("package" in source ? source.package : ""),
        );
        const definition = asPluginDefinition(module, id);
        securityPlugin = Boolean(definition.metadata.security);
        if (securityPlugin && !source.critical)
          throw new Error("Security plugins require critical: true");
        if (definition.metadata.id !== id)
          throw new Error(
            `Package declares plugin id "${definition.metadata.id}" but is configured as "${id}"`,
          );
        const storage = this.host.storage(id);
        this.pluginStorage.set(id, storage);
        const prepared = definition.prepare(source.config, {
          services: this.services,
          storage,
          stores: this.host.stores(id),
          logger: pluginLogger(id),
        });
        const browserPath =
          built?.browserBundlePath ??
          ("browserBundle" in source && source.browserBundle
            ? resolveInstalledBundle(source.browserBundle)
            : undefined);
        requests.push({
          id,
          definition,
          prepared,
          browserPath,
        });
      } catch (error) {
        if (source.critical || securityPlugin)
          this.failSecurity(id, `could not load: ${errorMessage(error)}`);
        this.readiness.set(id, {
          status: "unavailable",
          detail: `Plugin package, metadata, or configuration is invalid: ${errorMessage(error)}`,
        });
      }
    }

    const ordered = sortDependencies(requests, this.readiness);
    for (const request of requests)
      if (
        (request.definition.metadata.security ||
          sources[request.id]?.critical) &&
        this.readiness.get(request.id)?.status === "unavailable"
      )
        this.failSecurity(request.id, "dependency failed");
    const pendingContributions = new Map<string, Contributions>();
    for (const request of ordered) {
      const contributions = emptyContributions();
      const seenPages: RuntimePluginPage[] = [];
      const seenNavigation: PluginNavigationItem[] = [];
      const seenSlots: RuntimePluginSlot[] = [];
      const seenProcedures: RegisteredProcedure[] = [];
      const seenActions: RuntimePluginAction[] = [];
      const seenResources: RuntimePluginResource[] = [];
      const registry = {
        page: (page: RuntimePluginPage) => {
          // Re-checked here, not only in `definePlugin`: the host validates a
          // duck-typed definition it did not construct, and an unauthenticated
          // page is exactly the thing a host must not take on trust.
          if (page.public && !request.definition.metadata.security)
            throw new Error(
              "Only plugins declaring security: true may register a public page",
            );
          if (
            page.shell !== undefined &&
            page.shell !== "app" &&
            page.shell !== "bare"
          )
            throw new Error(
              `Plugin "${request.id}" has invalid page shell "${page.shell}"`,
            );
          uniqueId(seenPages, page, "page", request.id);
        },
        navigation: (item: PluginNavigationItem) =>
          uniqueId(seenNavigation, item, "navigation", request.id),
        slot: (slot: RuntimePluginSlot) =>
          uniqueId(seenSlots, slot, "slot", request.id),
        procedure: (procedure: RegisteredProcedure) => {
          uniqueId(seenProcedures, procedure, "procedure", request.id);
          contributions.procedures.push(procedure);
        },
        // `action` and `procedure` are the same runtime shape; both are kept so
        // an id declared either way resolves through one lookup.
        action: (action: RuntimePluginAction) => {
          uniqueId(seenActions, action, "action", request.id);
          if (
            action.permission !== "inspect" &&
            action.permission !== "execute" &&
            action.permission !== "manage"
          )
            throw new Error(
              `Plugin "${request.id}" action "${action.id}" has invalid permission "${String(action.permission)}"`,
            );
          seenActions.push(action);
        },
        resource: (resource: RuntimePluginResource) => {
          uniqueId(seenResources, resource, "resource", request.id);
          // A resource with no policy would never refresh, so reject it rather
          // than serve data that silently goes stale.
          if (
            resource.refresh?.kind !== "manual" &&
            resource.refresh?.kind !== "poll"
          )
            throw new Error(
              `Plugin "${request.id}" resource "${resource.id}" has an invalid refresh policy`,
            );
          contributions.resources.push(resource);
        },
        job: (job: RuntimePluginJob) => {
          uniqueId(contributions.jobs, job, "job", request.id);
          // An unparseable schedule is rejected here rather than silently never
          // firing: a job that looks scheduled and never runs is worse than a
          // startup error naming the expression.
          if (job.schedule !== undefined) {
            const schedule = parseCron(job.schedule);
            if (!schedule.valid)
              throw new Error(
                `Plugin "${request.id}" job "${job.id}" has an invalid cron expression: "${job.schedule}"`,
              );
            if (schedule.nextAfter(new Date()) === null)
              throw new Error(
                `Plugin "${request.id}" job "${job.id}" schedule never fires: "${job.schedule}"`,
              );
          }
          if (!Number.isInteger(job.timeoutMs) || job.timeoutMs < 1)
            throw new Error(
              `Plugin "${request.id}" job "${job.id}" timeout must be a positive integer`,
            );
          if (job.schedule !== undefined && job.intervalMs !== undefined)
            throw new Error(
              `Plugin "${request.id}" job "${job.id}" cannot set both schedule and intervalMs`,
            );
          if (
            job.intervalMs !== undefined &&
            (!Number.isInteger(job.intervalMs) || job.intervalMs < 250)
          )
            throw new Error(
              `Plugin "${request.id}" job "${job.id}" intervalMs must be an integer of at least 250`,
            );
          if (
            !Number.isInteger(job.retry.maxAttempts) ||
            job.retry.maxAttempts < 1
          )
            throw new Error(
              `Plugin "${request.id}" job "${job.id}" needs at least one attempt`,
            );
          if (
            !Number.isInteger(job.retry.backoffMs) ||
            job.retry.backoffMs < 0 ||
            (job.retry.maxAttempts > 1 && job.retry.backoffMs < 1)
          )
            throw new Error(
              `Plugin "${request.id}" job "${job.id}" has an invalid retry backoff`,
            );
          if (job.concurrency !== "singleton" && job.concurrency !== "per-key")
            throw new Error(
              `Plugin "${request.id}" job "${job.id}" has invalid concurrency`,
            );
        },
        authentication: (provider: PluginAuthenticationProvider) => {
          if (typeof provider?.authenticate !== "function")
            throw new Error("Invalid authentication provider");
          if (contributions.authentication)
            throw new Error("Duplicate authentication provider");
          contributions.authentication = provider;
        },
        authorization: (provider: PluginAuthorizationProvider) => {
          if (typeof provider?.authorize !== "function")
            throw new Error("Invalid authorization provider");
          if (contributions.authorization)
            throw new Error("Duplicate authorization provider");
          contributions.authorization = provider;
        },
      };
      try {
        request.prepared.setup(registry);
      } catch (error) {
        try {
          await request.definition.stop?.();
        } catch {
          // Keep the original setup failure as the plugin readiness outcome.
        }
        this.closeStorage(request.id);
        if (
          request.definition.metadata.security ||
          sources[request.id]?.critical
        )
          this.failSecurity(request.id, "setup failed");
        this.readiness.set(request.id, {
          status: "unavailable",
          detail: `Plugin contribution setup failed: ${errorMessage(error)}`,
        });
        continue;
      }
      contributions.pages = seenPages;
      contributions.navigation = seenNavigation;
      contributions.slots = seenSlots;
      contributions.procedures = seenProcedures;
      contributions.actions = seenActions;
      pendingContributions.set(request.id, contributions);
    }

    for (const [pluginId, contributions] of pendingContributions) {
      const pageIds = new Set(contributions.pages.map((page) => page.id));
      for (const item of contributions.navigation) {
        if (!pageIds.has(item.pageId))
          this.readiness.set(pluginId, {
            status: "unavailable",
            detail: `Navigation item "${item.id}" references a missing page`,
          });
      }
    }
    for (const request of requests)
      if (
        (request.definition.metadata.security ||
          sources[request.id]?.critical) &&
        this.readiness.get(request.id)?.status === "unavailable"
      )
        this.failSecurity(request.id, "invalid contributions");

    const authPlugins = [...pendingContributions].filter(
      ([, contribution]) => contribution.authentication,
    );
    const policyPlugins = [...pendingContributions].filter(
      ([, contribution]) => contribution.authorization,
    );
    if (authPlugins.length > 1 || policyPlugins.length > 1)
      this.failSecurity(
        "providers",
        "only one authentication and authorization provider may be active",
      );

    for (const request of ordered) {
      if (this.readiness.get(request.id)?.status === "unavailable") continue;
      const failedDependency = (request.definition.requires ?? []).find(
        (dependency) => this.readiness.get(dependency)?.status !== "ready",
      );
      if (failedDependency) {
        if (
          request.definition.metadata.security ||
          sources[request.id]?.critical
        )
          this.failSecurity(
            request.id,
            `requires unavailable plugin "${failedDependency}"`,
          );
        this.readiness.set(request.id, {
          status: "unavailable",
          detail: `Dependency "${failedDependency}" is unavailable`,
        });
        continue;
      }

      try {
        await request.prepared.start();
        if (pendingContributions.get(request.id)?.authentication) {
          this.authenticationProvider = pendingContributions.get(
            request.id,
          )?.authentication;
          this.authenticationPluginId_ = request.id;
        }
        if (pendingContributions.get(request.id)?.authorization)
          this.authorizationProvider = pendingContributions.get(
            request.id,
          )?.authorization;
        this.active.set(request.id, {
          definition: request.definition,
          browserPath: request.browserPath,
          browserSha256: request.browserSha256,
        });
        this.contributions.set(
          request.id,
          pendingContributions.get(request.id) ?? emptyContributions(),
        );
        this.readiness.set(request.id, { status: "ready" });
      } catch (error) {
        try {
          await request.definition.stop?.();
        } catch {
          // Keep the original startup failure as the plugin readiness outcome.
        }
        this.closeStorage(request.id);
        if (
          request.definition.metadata.security ||
          sources[request.id]?.critical ||
          pendingContributions.get(request.id)?.authentication ||
          pendingContributions.get(request.id)?.authorization
        )
          this.failSecurity(request.id, "failed to start");
        this.readiness.set(request.id, {
          status: "unavailable",
          detail: `Plugin failed during startup: ${errorMessage(error)}`,
        });
      }
    }
  }

  catalog(): PluginCatalog {
    const plugins = [...this.readiness.entries()].map(([id, readiness]) => {
      const active = this.active.get(id);
      return {
        id,
        name: active?.definition.metadata.name ?? id,
        version: active?.definition.metadata.version ?? "unknown",
        ...readiness,
      };
    });
    const pages: PluginCatalog["pages"] = [];
    const navigation: PluginCatalog["navigation"] = [];
    const slots: PluginCatalog["slots"] = [];
    for (const [pluginId, items] of this.contributions) {
      pages.push(
        ...items.pages.map(
          ({ id, title, description, public: isPublic, shell }) => ({
            id,
            title,
            ...(description ? { description } : {}),
            ...(isPublic ? { public: true } : {}),
            ...(shell && shell !== "app" ? { shell } : {}),
            pluginId,
          }),
        ),
      );
      navigation.push(
        ...items.navigation.map((item) => ({ ...item, pluginId })),
      );
      slots.push(
        ...items.slots.map(({ id, slot, order }) => ({
          id,
          slot,
          order,
          pluginId,
        })),
      );
    }
    navigation.sort(
      (left, right) =>
        (left.order ?? 0) - (right.order ?? 0) ||
        left.pluginId.localeCompare(right.pluginId) ||
        left.id.localeCompare(right.id),
    );
    slots.sort(
      (left, right) =>
        (left.order ?? 0) - (right.order ?? 0) ||
        left.pluginId.localeCompare(right.pluginId) ||
        left.id.localeCompare(right.id),
    );
    return { plugins, pages, navigation, slots };
  }

  async renderPage(
    pluginId: string,
    pageId: string,
    params: Record<string, string> = {},
  ): Promise<PageDocument | null> {
    const page = this.contributions
      .get(pluginId)
      ?.pages.find((candidate) => candidate.id === pageId);
    if (!page || !this.active.has(pluginId)) return null;
    return {
      path: `/${pageId}`,
      nodes: this.attachBrowserUrl(pluginId, await page.render(params)),
    };
  }

  async renderSlot(
    pluginId: string,
    slotId: string,
    context: { service: PluginServiceSummary },
  ): Promise<
    readonly import("@northgraindata/dsui-plugin-sdk").PageNode[] | null
  > {
    const slot = this.contributions
      .get(pluginId)
      ?.slots.find((item) => item.id === slotId);
    if (!slot || !this.active.has(pluginId)) return null;
    return this.attachBrowserUrl(pluginId, await slot.render(context));
  }

  private attachBrowserUrl(
    pluginId: string,
    nodes: readonly import("@northgraindata/dsui-plugin-sdk").PageNode[],
  ): readonly import("@northgraindata/dsui-plugin-sdk").PageNode[] {
    const browserPath = this.browserBundle(pluginId);
    const mapValue = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(mapValue);
      if (!value || typeof value !== "object") return value;
      const record = value as Record<string, unknown>;
      if (
        record.kind === "custom" &&
        record.props &&
        typeof record.props === "object"
      ) {
        const props = record.props as Record<string, unknown>;
        // Two kinds of `custom` node reach a plugin page. One points at a
        // component the renderer already bundles — an SDK primitive, which
        // always declares `./ui/...` — and needs no URL. The other is a
        // component the plugin itself ships, and its `path` points at the
        // plugin's own browser module, so the URL has to be attached or the
        // browser looks for an adapter that does not exist. Deciding on the
        // path rather than the id keeps both working: a primitive is named
        // "chart", not "<plugin>/chart".
        const path = typeof props.path === "string" ? props.path : "";
        const builtin = path.startsWith("./ui/");
        if (builtin) return record;
        if (
          typeof props.component === "string" &&
          props.component.startsWith(`${pluginId}/`)
        ) {
          if (!browserPath)
            throw new Error("Plugin custom component has no browser bundle");
          return {
            ...record,
            props: {
              ...props,
              browserUrl: `/api/v1/plugins/${encodeURIComponent(pluginId)}/components.mjs`,
            },
          };
        }
        throw new Error("Plugin custom component id must be namespaced");
      }
      return Object.fromEntries(
        Object.entries(record).map(([key, item]) => [key, mapValue(item)]),
      );
    };
    return nodes.map(
      (node) =>
        mapValue(node) as import("@northgraindata/dsui-plugin-sdk").PageNode,
    );
  }

  browserBundle(
    pluginId: string,
  ): { path: string; sha256?: string } | undefined {
    const active = this.active.get(pluginId);
    return active?.browserPath
      ? { path: active.browserPath, sha256: active.browserSha256 }
      : undefined;
  }

  service(id: string): Promise<PluginServiceSummary | null> {
    return this.services.get(id);
  }

  hasAuthentication(): boolean {
    return this.securityFailure || Boolean(this.authenticationProvider);
  }

  /**
   * The active authentication plugin's identity endpoints.
   *
   * The host mounts these itself at `/api/auth/<pluginId>/*` rather than
   * letting the plugin route: the mount has to happen ahead of the
   * authentication middleware, because these are the endpoints a logged-out
   * browser is trying to reach.
   *
   * A path that resolves to no plugin is not a match, so a request cannot be
   * routed to a plugin that is not installed.
   */
  authenticationRoutes(
    pluginId: string,
  ): ((request: Request) => Promise<Response> | Response) | undefined {
    if (this.securityFailure) return undefined;
    if (pluginId !== this.authenticationPluginId) return undefined;
    return this.authenticationProvider?.routes?.bind(
      this.authenticationProvider,
    );
  }

  /** The plugin currently providing authentication, if any. */
  get authenticationPluginId(): string | undefined {
    return this.securityFailure ? undefined : this.authenticationPluginId_;
  }

  /**
   * Whether a request to this path must resolve a principal.
   *
   * The middleware consults this before rejecting a logged-out caller. A public
   * page is the one case where an anonymous request is legitimate, and it is
   * reachable only because a `security: true` plugin declared it.
   */
  requiresPrincipal(pathname: string): boolean {
    if (this.securityFailure) return true;
    if (!this.authenticationProvider) return false;
    // The catalog is answerable anonymously because it redacts itself for an
    // anonymous caller: it reports public pages and withholds everything else,
    // which is what lets a client reach a sign-in screen it cannot yet
    // authorize.
    if (pathname === "/api/v1/plugins") return false;
    const browserBundleMatch =
      /^\/api\/v1\/plugins\/([a-z][a-z0-9-]*)\/components\.mjs$/.exec(
        pathname,
      );
    if (
      browserBundleMatch &&
      this.browserBundleIsPublic(browserBundleMatch[1]!)
    )
      return false;
    return !this.isPublicPagePath(pathname);
  }

  /**
   * Whether an anonymous browser may fetch a plugin bundle to render its
   * public sign-in page. Other plugins' bundles remain behind authentication.
   */
  browserBundleIsPublic(pluginId: string): boolean {
    if (this.securityFailure || pluginId !== this.authenticationPluginId_)
      return false;
    return Boolean(
      this.active.get(pluginId)?.browserPath &&
        this.contributions
          .get(pluginId)
          ?.pages.some((page) => page.public),
    );
  }

  private isPublicPagePath(pathname: string): boolean {
    for (const [pluginId, contributions] of this.contributions)
      for (const page of contributions.pages)
        if (
          page.public &&
          pathname ===
            `/api/v1/plugins/${encodeURIComponent(pluginId)}/pages/${page.id}`
        )
          return true;
    return false;
  }

  /**
   * Whether a page was declared public by a security plugin.
   *
   * The page route uses this instead of resolving the path, so a public page
   * serves without a principal and everything else is still authorized.
   */
  pageIsPublic(pluginId: string, pageId: string): boolean {
    if (this.securityFailure) return false;
    return Boolean(
      this.contributions.get(pluginId)?.pages.find((page) => page.id === pageId)
        ?.public,
    );
  }

  /**
   * Asks the authentication plugin to resolve the request identity.
   *
   * The role must be one the host knows, because the host applies the role's
   * permission grants before consulting any `authorize` provider. A plugin
   * modelling richer access control expresses that in `attributes` and uses
   * `authorize` to narrow; it does not invent a new role name. An
   * unrecognised role is rejected rather than treated as least-privileged, so
   * a malformed principal cannot accidentally gain access.
   */
  async authenticate(request: Request): Promise<PluginPrincipal | null> {
    const principal = await this.authenticationProvider?.authenticate(request);
    if (
      !principal ||
      typeof principal.id !== "string" ||
      !principal.id ||
      !["owner", "admin", "operator", "viewer"].includes(principal.role)
    )
      return null;
    return principal;
  }

  async authorize(
    principal: PluginPrincipal,
    permission: PluginPermission,
    resource?: PluginResource,
  ): Promise<boolean> {
    if (this.securityFailure) return false;
    if (!allowed(principal, permission)) return false;
    if (!this.authorizationProvider) return true;
    return (
      (await this.authorizationProvider.authorize({
        principal,
        permission,
        resource,
      })) === true
    );
  }

  withPrincipal<T>(
    principal: PluginPrincipal,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.principalContext.run(principal, operation);
  }

  async canAccessService(id: string): Promise<boolean> {
    const principal = this.principalContext.getStore();
    if (!principal) {
      if (this.authorizationProvider)
        throw new Error("Plugin service access requires a principal");
      return true;
    }
    return this.authorize(principal, "inspect", { type: "service", id });
  }

  /**
   * Resolves a callable by id, whether the plugin declared it with
   * `defineAction` or as a procedure. Both produce the same invoke shape, so a
   * caller should not have to care which name was used.
   */
  procedure(
    pluginId: string,
    procedureId: string,
  ): {
    procedure: RegisteredProcedure;
  } | null {
    const contributions = this.contributions.get(pluginId);
    const procedure =
      contributions?.procedures.find((item) => item.id === procedureId) ??
      contributions?.actions.find((item) => item.id === procedureId);
    return procedure && this.active.has(pluginId) ? { procedure } : null;
  }

  /**
   * Declared resources for one plugin, with the freshness policy each was
   * registered with. The host serves this so a browser can poll on the same
   * terms it polls an adapter.
   */
  resources(pluginId: string): RuntimePluginResource[] {
    if (!this.active.has(pluginId)) return [];
    return this.contributions.get(pluginId)?.resources ?? [];
  }

  /** Active jobs available to the in-process background worker. */
  jobs(): Array<{ pluginId: string; job: RuntimePluginJob }> {
    return [...this.contributions].flatMap(([pluginId, contributions]) =>
      this.active.has(pluginId)
        ? contributions.jobs.map((job) => ({ pluginId, job }))
        : [],
    );
  }

  async close(): Promise<void> {
    this.stopped = true;
    await this.stopActive();
    this.contributions.clear();
    this.authenticationProvider = undefined;
    this.authenticationPluginId_ = undefined;
    this.authorizationProvider = undefined;
  }

  private failSecurity(id: string, reason: string): never {
    this.securityFailure = true;
    throw new Error(`Security plugin "${id}" ${reason}`);
  }

  private async stopActive(): Promise<void> {
    const active = [...this.active.entries()].reverse();
    this.active.clear();
    for (const [id, plugin] of active) {
      try {
        await plugin.definition.stop?.();
      } catch {
        console.error(`Could not stop plugin "${id}"`);
      }
      this.closeStorage(id);
    }
  }

  /**
   * Closes the databases a plugin opened.
   *
   * Only once the plugin has stopped: a handle it still holds would otherwise
   * be closed out from under it.
   */
  private closeStorage(id: string): void {
    const storage = this.pluginStorage.get(id);
    if (!storage) return;
    this.pluginStorage.delete(id);
    try {
      storage.close();
    } catch {
      console.error(`Could not close storage for plugin "${id}"`);
    }
  }
}
