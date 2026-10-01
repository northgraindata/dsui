import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
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
  type PreparedPlugin,
  type RuntimePluginDefinition,
  type RuntimePluginPage,
  type RuntimePluginProcedure,
  type RuntimePluginSlot,
} from "@northgraindata/dsui-plugin-sdk";
import { allowed } from "../auth.js";
import type { PluginSource } from "../config.js";
import { installGitPlugin, type PluginFetch } from "./installer.js";

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

function resolveInstalledBundle(specifier: string): string {
  const builtIn = builtInPluginPath(specifier);
  if (builtIn) return builtIn;
  return requireFromWorkingDirectory.resolve(specifier);
}

function builtInPluginPath(specifier: string): string | undefined {
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
  const builtIn = builtInPluginPath(specifier);
  if (builtIn) return import(pathToFileURL(builtIn).href);
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

function emptyContributions(): Contributions {
  return { pages: [], navigation: [], slots: [], procedures: [] };
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
  private stopped = false;
  private securityFailure = false;
  private readonly principalContext = new AsyncLocalStorage<PluginPrincipal>();
  private authenticationProvider?: PluginAuthenticationProvider;
  private authorizationProvider?: PluginAuthorizationProvider;

  constructor(
    private readonly services: PluginServiceCatalog,
    private readonly loadModule: PluginModuleLoader = loadInstalledPlugin,
    private readonly sourceOptions: {
      dataDir?: string;
      fetch?: PluginFetch;
      offline?: boolean;
    } = {},
  ) {}

  async load(sources: Record<string, PluginSource>): Promise<void> {
    if (this.stopped) throw new Error("Plugin runtime is stopped");
    await this.stopActive();
    this.securityFailure = false;
    this.readiness.clear();
    this.contributions.clear();
    this.authenticationProvider = undefined;
    this.authorizationProvider = undefined;

    const requests: PluginLoadRequest[] = [];
    for (const [id, source] of Object.entries(sources)) {
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
        const installed =
          "source" in source && source.source === "git"
            ? await installGitPlugin(id, source, {
                dataDir: this.sourceOptions.dataDir ?? process.cwd(),
                fetch: this.sourceOptions.fetch,
                offline: this.sourceOptions.offline,
              })
            : undefined;
        const module = await this.loadModule(
          installed?.serverPath ?? ("package" in source ? source.package : ""),
        );
        const definition = asPluginDefinition(module, id);
        securityPlugin = Boolean(definition.metadata.security);
        if (securityPlugin && !source.critical)
          throw new Error("Security plugins require critical: true");
        if (definition.metadata.id !== id)
          throw new Error(
            `Package declares plugin id "${definition.metadata.id}" but is configured as "${id}"`,
          );
        const prepared = definition.prepare(source.config, {
          services: this.services,
          logger: pluginLogger(id),
        });
        const browserPath =
          installed?.browserPath ??
          ("browserBundle" in source && source.browserBundle
            ? resolveInstalledBundle(source.browserBundle)
            : undefined);
        if (
          installed &&
          installed.manifest.version !== definition.metadata.version
        )
          throw new Error(
            "Plugin manifest version differs from bundle metadata",
          );
        requests.push({
          id,
          definition,
          prepared,
          browserPath,
          browserSha256: installed?.manifest.browser?.sha256,
        });
      } catch {
        if (source.critical || securityPlugin)
          this.failSecurity(id, "could not load");
        this.readiness.set(id, {
          status: "unavailable",
          detail: "Plugin package, metadata, or configuration is invalid",
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
      const registry = {
        page: (page: RuntimePluginPage) =>
          uniqueId(seenPages, page, "page", request.id),
        navigation: (item: PluginNavigationItem) =>
          uniqueId(seenNavigation, item, "navigation", request.id),
        slot: (slot: RuntimePluginSlot) =>
          uniqueId(seenSlots, slot, "slot", request.id),
        procedure: (procedure: RegisteredProcedure) =>
          uniqueId(seenProcedures, procedure, "procedure", request.id),
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
      } catch {
        try {
          await request.definition.stop?.();
        } catch {
          // Keep the original setup failure as the plugin readiness outcome.
        }
        if (
          request.definition.metadata.security ||
          sources[request.id]?.critical
        )
          this.failSecurity(request.id, "setup failed");
        this.readiness.set(request.id, {
          status: "unavailable",
          detail: "Plugin contribution setup failed",
        });
        continue;
      }
      contributions.pages = seenPages;
      contributions.navigation = seenNavigation;
      contributions.slots = seenSlots;
      contributions.procedures = seenProcedures;
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
        if (pendingContributions.get(request.id)?.authentication)
          this.authenticationProvider = pendingContributions.get(
            request.id,
          )?.authentication;
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
      } catch {
        try {
          await request.definition.stop?.();
        } catch {
          // Keep the original startup failure as the plugin readiness outcome.
        }
        if (
          request.definition.metadata.security ||
          sources[request.id]?.critical ||
          pendingContributions.get(request.id)?.authentication ||
          pendingContributions.get(request.id)?.authorization
        )
          this.failSecurity(request.id, "failed to start");
        this.readiness.set(request.id, {
          status: "unavailable",
          detail: "Plugin failed during startup",
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
        ...items.pages.map(({ id, title, description }) => ({
          id,
          title,
          ...(description ? { description } : {}),
          pluginId,
        })),
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

  procedure(
    pluginId: string,
    procedureId: string,
  ): {
    procedure: RegisteredProcedure;
  } | null {
    const procedure = this.contributions
      .get(pluginId)
      ?.procedures.find((item) => item.id === procedureId);
    return procedure && this.active.has(pluginId) ? { procedure } : null;
  }

  async close(): Promise<void> {
    this.stopped = true;
    await this.stopActive();
    this.contributions.clear();
    this.authenticationProvider = undefined;
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
    }
  }
}
