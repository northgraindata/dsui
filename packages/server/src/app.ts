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
  type DsuiConfig,
  isAdapterSource,
  type LocalAdapterSource,
  loadConfig,
  type NpmAdapterSource,
} from "./config.js";
import { ConnectionCipher } from "./db/crypto.js";
import { DsuiDatabase } from "./db/database.js";
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
  const cipher =
    (options.masterKey ?? process.env.DSUI_MASTER_KEY)
      ? new ConnectionCipher(
          options.masterKey ?? process.env.DSUI_MASTER_KEY ?? "",
        )
      : undefined;
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
  const loaderOptions: AdapterLoadOptions = {
    dataDir: options.adaptersDataDir ?? dataDir,
    fetch: options.adapterFetch,
    offline: options.offlineAdapters,
    spawnHost: options.spawnHost,
  };

  /**
   * Loads every configured adapter through the uniform loader and
   * records per-adapter readiness. One bad entry marks itself
   * unavailable instead of blocking startup; unknown override ids
   * are ignored by the registry. A local installation with no
   * `adapters:` section includes bundled adapters.
   */
  const adapterCache = new Map<
    string,
    { source: string; adapter: LoadedAdapter }
  >();
  const syncAdapters = async (loaded: DsuiConfig) => {
    const next: LoadedAdapter[] = [];
    readiness.clear();
    const entries = Object.entries(
      loaded.adapters === undefined
        ? {
            duckdb: {
              package: "@northgraindata/dsui-adapter-duckdb",
            },
            snowflake: {
              package: "@northgraindata/dsui-adapter-snowflake",
            },
          }
        : loaded.adapters,
    );
    const sources: Array<[string, LocalAdapterSource | NpmAdapterSource]> =
      entries.flatMap(([id, entry]) =>
        isAdapterSource(entry) ? [[id, entry] as const] : [],
      );
    for (const [id, source] of sources) {
      try {
        const fingerprint = JSON.stringify(source);
        const cached = adapterCache.get(id);
        if (cached && cached.source !== fingerprint) {
          await cached.adapter.backend.dispose?.();
          adapterCache.delete(id);
        }
        const loadedAdapter =
          (cached?.source === fingerprint ? cached.adapter : undefined) ??
          (await loadAdapter(
            id,
            "version" in source
              ? {
                  package: source.package,
                  version: source.version,
                  integrity: source.integrity,
                  ...(source.entry ? { entry: source.entry } : {}),
                }
              : { package: source.package },
            loaderOptions,
          ));
        adapterCache.set(id, { source: fingerprint, adapter: loadedAdapter });
        next.push(loadedAdapter);
        readiness.set(id, {
          status: "ok",
          detail: `${loadedAdapter.metadata.name}`,
        });
      } catch (error) {
        readiness.set(id, {
          status: "unavailable",
          detail: error instanceof Error ? error.message : "Load failed",
        });
      }
    }
    for (const [id, cached] of adapterCache) {
      if (!sources.some(([nextId]) => nextId === id)) {
        await cached.adapter.backend.dispose?.();
        adapterCache.delete(id);
      }
    }
    registry.reset(next);
    for (const [id, override] of Object.entries(loaded.adapters ?? {}))
      if (!isAdapterSource(override)) registry.applyMetadata(id, override);
  };

  const refresh = async () => {
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
    for (const previous of config.services) {
      const replacement = loaded.services.find(
        (service) => service.id === previous.id,
      );
      if (JSON.stringify(previous) !== JSON.stringify(replacement))
        await adapterCache
          .get(previous.adapter)
          ?.adapter.backend.closeSession?.(previous.id);
    }
    await syncAdapters(loaded);
    config = loaded;
    return config;
  };

  let refreshing: Promise<DsuiConfig> | undefined;
  const refreshConfig = () => {
    refreshing ??= refresh().finally(() => {
      refreshing = undefined;
    });
    return refreshing;
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
  });
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
    refreshConfig,
    close: async () => {
      await refreshing;
      try {
        await Promise.all(
          [...adapterCache.values()].map(({ adapter }) =>
            adapter.backend.dispose?.(),
          ),
        );
      } finally {
        database.close();
      }
    },
  };
}
