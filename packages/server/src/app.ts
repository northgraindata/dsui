import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { type AdapterLoadOptions, loadAdapter } from "./adapters/loader.js";
import { AdapterRegistry } from "./adapters/registry.js";
import type { AdapterReadiness, LoadedAdapter } from "./adapters/types.js";
import {
  type AuthMode,
  createEnterpriseAuth,
  type EnterpriseProvider,
  type Principal,
} from "./auth.js";
import {
  type AdapterSource,
  type DsuiConfig,
  isAdapterSource,
  loadConfig,
  toAdapterPackageSource,
} from "./config.js";
import { ConnectionCipher, resolveMasterKey } from "./db/crypto.js";
import { DsuiDatabase } from "./db/database.js";
import { SqliteStorePersistenceProvider } from "./db/store-persistence.js";
import type { PluginFetch } from "./plugins/installer.js";
import { registerPluginRoutes } from "./plugins/routes.js";
import {
  BUILT_IN_PLUGIN_IDS,
  builtInSourceMap,
} from "./plugins/built-in.js";
import { type PluginModuleLoader, PluginRuntime } from "./plugins/runtime.js";
import { registerAdapterRoutes } from "./routes/adapters.js";
import { type EnterpriseAuthKit, registerAuthRoutes } from "./routes/auth.js";
import { registerExecuteRoutes } from "./routes/execute.js";
import { registerServiceRoutes } from "./routes/services.js";
import { registerSystemRoutes } from "./routes/system.js";

export type Runtime = ReturnType<typeof createRuntime>;

export type CreateRuntimeOptions = {
  dataDir?: string;
  databasePath?: string;
  configPath?: string;
  config?: DsuiConfig;
  masterKey?: string;
  authMode?: AuthMode;
  /** Enterprise-only override for DSUI_AUTH_URL. */
  enterpriseAuthUrl?: string;
  /** Enterprise-only override for DSUI_AUTH_SECRET. */
  enterpriseAuthSecret?: string;
  /** Additional exact browser origins allowed to call Better Auth. */
  enterpriseTrustedOrigins?: string[];
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
};

function requiredEnterpriseAuthUrl(value: string | undefined): string {
  if (!value) throw new Error("DSUI_AUTH_URL is required in enterprise mode");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DSUI_AUTH_URL must be an absolute URL");
  }
  if (url.username || url.password)
    throw new Error("DSUI_AUTH_URL must not include credentials");
  if (url.pathname !== "/" || url.search || url.hash)
    throw new Error(
      "DSUI_AUTH_URL must be an origin without a path, query, or fragment",
    );
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    throw new Error("DSUI_AUTH_URL must use HTTPS in production");
  return url.origin;
}

function exactOrigins(values: string[]): string[] {
  return [
    ...new Set(
      values.map((value) => {
        const url = new URL(value);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.pathname !== "/" ||
          url.search ||
          url.hash
        )
          throw new Error(
            "DSUI_AUTH_TRUSTED_ORIGINS entries must be plain HTTP(S) origins",
          );
        return url.origin;
      }),
    ),
  ];
}

export function createRuntime(options: CreateRuntimeOptions = {}) {
  const dataDir =
    options.dataDir ??
    process.env.DSUI_DATA_DIR ??
    join(
      process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"),
      "dsui",
    );
  const databasePath = options.databasePath ?? join(dataDir, "dsui.sqlite");
  const configPath =
    options.configPath ??
    process.env.DSUI_CONFIG ??
    (existsSync("/etc/dsui/dsui.yaml") ? "/etc/dsui/dsui.yaml" : undefined);
  const registry = new AdapterRegistry();
  const readiness = new Map<string, AdapterReadiness>();
  const database = new DsuiDatabase(databasePath);
  const authMode =
    options.authMode ??
    (process.env.DSUI_AUTH_MODE as AuthMode | undefined) ??
    "none";
  if (!["none", "local", "enterprise"].includes(authMode))
    throw new Error("DSUI_AUTH_MODE must be none, local, or enterprise");
  const masterKey = resolveMasterKey(
    dataDir,
    options.masterKey ?? process.env.DSUI_MASTER_KEY,
  );
  const cipher = new ConnectionCipher(masterKey);
  const enterpriseAuth = (() => {
    if (authMode !== "enterprise") return undefined;
    if (!cipher)
      throw new Error(
        "DSUI_MASTER_KEY is required for enterprise authentication",
      );
    const secret =
      options.enterpriseAuthSecret ??
      process.env.DSUI_AUTH_SECRET ??
      process.env.BETTER_AUTH_SECRET;
    if (!secret || secret.length < 32)
      throw new Error(
        "DSUI_AUTH_SECRET must contain at least 32 characters in enterprise mode",
      );
    const baseURL = requiredEnterpriseAuthUrl(
      options.enterpriseAuthUrl ??
        process.env.DSUI_AUTH_URL ??
        process.env.BETTER_AUTH_URL,
    );
    const configuredOrigins = (process.env.DSUI_AUTH_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const providers: EnterpriseProvider[] = database
      .listEnterpriseSsoProviders()
      .map((provider) => {
        const config = cipher.decrypt<Record<string, unknown>>({
          ciphertext: provider.config_ciphertext,
          iv: provider.config_iv,
          tag: provider.config_tag,
        });
        if (provider.protocol === "oidc")
          return {
            providerId: provider.provider_id,
            domain: provider.domain,
            oidcConfig: config as unknown as EnterpriseProvider["oidcConfig"],
          };
        return {
          providerId: provider.provider_id,
          domain: provider.domain,
          samlConfig: config as unknown as EnterpriseProvider["samlConfig"],
        };
      });
    return createEnterpriseAuth({
      database: database.sqlite,
      baseURL,
      secret,
      trustedOrigins: exactOrigins([
        baseURL,
        ...configuredOrigins,
        ...(options.enterpriseTrustedOrigins ?? []),
      ]),
      providers,
      provisionMember: (userId) => database.ensureEnterpriseMember(userId),
    });
  })();
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
        };
      });
    return [...configured, ...uiManaged].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
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
        const remaining = [];
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
    },
    options.pluginModuleLoader,
    { dataDir, fetch: options.pluginFetch, offline: options.offlinePlugins },
  );
  let pluginsLoaded = false;
  let pluginSync: Promise<void> | undefined;
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
   * are ignored by the registry. A local installation with no
   * `adapters:` section includes bundled adapters.
   */
  const syncAdapters = async (loaded: DsuiConfig) => {
    const next: LoadedAdapter[] = [];
    readiness.clear();
    const entries = Object.entries(
      loaded.adapters === undefined
        ? {
            airflow: {
              package: "@northgraindata/dsui-adapter-airflow",
            },
            duckdb: {
              package: "@northgraindata/dsui-adapter-duckdb",
            },
            dbt: {
              package: "@northgraindata/dsui-adapter-dbt",
            },
            postgresql: {
              package: "@northgraindata/dsui-adapter-postgresql",
            },
            s3: {
              package: "@northgraindata/dsui-adapter-s3",
            },
          }
        : loaded.adapters,
    );
    const sources: Array<[string, AdapterSource]> = entries.flatMap(
      ([id, entry]) => (isAdapterSource(entry) ? [[id, entry] as const] : []),
    );
    for (const [id, source] of sources) {
      try {
        const loadedAdapter = await loadAdapter(
          id,
          toAdapterPackageSource(source),
          loaderOptions,
        );
        next.push(loadedAdapter);
        readiness.set(id, {
          status: "ok",
          detail: `${loadedAdapter.metadata.name}`,
        });
      } catch (error) {
        console.error(`Could not load adapter "${id}"`, error);
        readiness.set(id, {
          status: "unavailable",
          detail: error instanceof Error ? error.message : "Load failed",
        });
      }
    }
    registry.reset(next);
    for (const [id, override] of Object.entries(loaded.adapters ?? {}))
      if (!isAdapterSource(override)) registry.applyMetadata(id, override);
  };

  const syncPlugins = async (loaded: DsuiConfig) => {
    const sources = loaded.plugins ?? {};
    if (pluginsLoaded) return;
    if (pluginSync) return pluginSync;
    pluginSync = pluginRuntime.load(
      sources,
      builtInSourceMap(),
      BUILT_IN_PLUGIN_IDS,
    );
    try {
      await pluginSync;
      if (enterpriseAuth && pluginRuntime.hasAuthentication())
        throw new Error(
          "Enterprise authentication cannot run alongside a plugin authentication provider",
        );
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

  const enterprisePrincipal = enterpriseAuth
    ? async (request: Request): Promise<{ id: string } | null> => {
        const session = await enterpriseAuth.api.getSession({
          headers: request.headers,
        });
        return session?.user?.id ? { id: session.user.id } : null;
      }
    : undefined;
  const enterpriseRole = enterpriseAuth
    ? (userId: string): Principal["role"] | null =>
        database.getEnterpriseRole(userId)
    : undefined;

  const app = new Hono();
  if (enterpriseAuth) {
    // Better Auth receives the original Fetch Request, which preserves query
    // parameters, form posts, callback state, and all Set-Cookie headers for
    // OIDC and SAML flows.
    app.all("/api/auth/*", (context) =>
      enterpriseAuth.handler(context.req.raw),
    );
  }
  const serviceDeps = {
    registry,
    pluginRuntime,
    database,
    cipher,
    getConfig,
    refreshConfig,
    audit,
  };
  registerSystemRoutes(app, {
    authMode,
    webRoot: options.webRoot,
  });
  registerAuthRoutes(app, {
    database,
    authMode,
    enterpriseAuth: enterpriseAuth as EnterpriseAuthKit,
    enterprisePrincipal,
    enterpriseRole,
    pluginRuntime,
  });
  registerPluginRoutes(app, { runtime: pluginRuntime, audit });
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
    refreshConfig,
    close: async () => {
      await pluginRuntime.close();
      database.close();
    },
  };
}
