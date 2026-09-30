import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type PageDocument,
  PLUGIN_API_VERSION,
  type PluginCatalog,
  type PluginNavigationItem,
  type PluginServiceCatalog,
  type PluginUiSlot,
  type PreparedPlugin,
  type RuntimePluginDefinition,
  type RuntimePluginPage,
  type RuntimePluginProcedure,
} from "@northgraindata/dsui-plugin-sdk";
import type { PluginSource } from "../config.js";

const pluginIdPattern = /^[a-z][a-z0-9-]*$/;

export type PluginReadiness = {
  status: PluginCatalog["plugins"][number]["status"];
  detail?: string;
};

type RegisteredProcedure = RuntimePluginProcedure;

type ActivePlugin = {
  definition: RuntimePluginDefinition;
};

type Contributions = {
  pages: RuntimePluginPage[];
  navigation: PluginNavigationItem[];
  slots: PluginUiSlot[];
  procedures: RegisteredProcedure[];
};

type PluginLoadRequest = {
  id: string;
  definition: RuntimePluginDefinition;
  prepared: PreparedPlugin;
};

export type PluginModuleLoader = (specifier: string) => Promise<unknown>;

const requireFromWorkingDirectory = createRequire(
  resolve(process.cwd(), "package.json"),
);

async function loadInstalledPlugin(specifier: string): Promise<unknown> {
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

  constructor(
    private readonly services: PluginServiceCatalog,
    private readonly loadModule: PluginModuleLoader = loadInstalledPlugin,
  ) {}

  async load(sources: Record<string, PluginSource>): Promise<void> {
    if (this.stopped) throw new Error("Plugin runtime is stopped");
    await this.stopActive();
    this.readiness.clear();
    this.contributions.clear();

    const requests: PluginLoadRequest[] = [];
    for (const [id, source] of Object.entries(sources)) {
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
        const module = await this.loadModule(source.package);
        const definition = asPluginDefinition(module, source.package);
        if (definition.metadata.id !== id)
          throw new Error(
            `Package declares plugin id "${definition.metadata.id}" but is configured as "${id}"`,
          );
        const prepared = definition.prepare(source.config, {
          services: this.services,
          logger: pluginLogger(id),
        });
        requests.push({ id, definition, prepared });
      } catch {
        this.readiness.set(id, {
          status: "unavailable",
          detail: "Plugin package, metadata, or configuration is invalid",
        });
      }
    }

    const ordered = sortDependencies(requests, this.readiness);
    const pendingContributions = new Map<string, Contributions>();
    for (const request of ordered) {
      const contributions = emptyContributions();
      const seenPages: RuntimePluginPage[] = [];
      const seenNavigation: PluginNavigationItem[] = [];
      const seenSlots: PluginUiSlot[] = [];
      const seenProcedures: RegisteredProcedure[] = [];
      const registry = {
        page: (page: RuntimePluginPage) =>
          uniqueId(seenPages, page, "page", request.id),
        navigation: (item: PluginNavigationItem) =>
          uniqueId(seenNavigation, item, "navigation", request.id),
        slot: (slot: PluginUiSlot) =>
          uniqueId(seenSlots, slot, "slot", request.id),
        procedure: (procedure: RegisteredProcedure) =>
          uniqueId(seenProcedures, procedure, "procedure", request.id),
      };
      try {
        request.prepared.setup(registry);
      } catch {
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

    for (const request of ordered) {
      if (this.readiness.get(request.id)?.status === "unavailable") continue;
      const failedDependency = (request.definition.requires ?? []).find(
        (dependency) => this.readiness.get(dependency)?.status !== "ready",
      );
      if (failedDependency) {
        this.readiness.set(request.id, {
          status: "unavailable",
          detail: `Dependency "${failedDependency}" is unavailable`,
        });
        continue;
      }

      try {
        await request.prepared.start();
        this.active.set(request.id, { definition: request.definition });
        this.contributions.set(
          request.id,
          pendingContributions.get(request.id) ?? emptyContributions(),
        );
        this.readiness.set(request.id, { status: "ready" });
      } catch {
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
      slots.push(...items.slots.map((item) => ({ ...item, pluginId })));
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
      nodes: await page.render(params),
    };
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
