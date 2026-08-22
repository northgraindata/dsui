import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join, resolve as resolveScript } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { z } from "zod";
import {
  AdapterRegistry,
  endpointFor,
  normalizeConnection,
  publicAdapter,
} from "./adapters";
import {
  type AuthMode,
  allowed,
  authentication,
  createEnterpriseAuth,
  type EnterpriseProvider,
  type Principal,
} from "./auth";
import {
  type ConfiguredService,
  communityAdapterEntries,
  type DsuiConfig,
  isCommunityAdapterSource,
  loadConfig,
} from "./config";
import { ConnectionCipher } from "./crypto";
import { DsuiDatabase, type UiServiceRow } from "./database";
import {
  type AdapterFetch,
  ExternalAdapterHostClient,
  ExternalAdapterManager,
  externalAdapterDefinition,
  type InstalledExternalAdapter,
} from "./external-adapters";

const LOGO_CONTENT_TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};
const MAX_LOGO_BYTES = 512 * 1024;
const httpUrl = /^https?:\/\//i;

export type PublicService = {
  id: string;
  name: string;
  adapter: string;
  category: string;
  endpoint: string;
  health: "healthy" | "warning" | "unavailable" | "unknown";
  detail?: string;
  latencyMs?: number;
  managedBy: "configuration" | "ui";
  capabilities: string[];
  logo?: string;
};
export type Runtime = ReturnType<typeof createRuntime>;

/**
 * The runtime context handed to a community adapter bundle. Production runs
 * each bundle in its own `dsui adapter-host --bundle` subprocess; tests inject
 * in-process doubles.
 */
export type AdapterHost = Pick<ExternalAdapterHostClient, "request">;
export type AdapterHostFactory = (
  logicalId: string,
  installed: InstalledExternalAdapter,
) => AdapterHost;

export type ReadinessCheck = {
  status: "ok" | "unavailable";
  detail?: string;
};
export type ReadinessReport = {
  status: "ok" | "unavailable";
  checks: Record<string, ReadinessCheck>;
};

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
  adapterRegistry?: AdapterRegistry;
  webRoot?: string;
  /** Store for verified community-adapter artifacts. Defaults to <dataDir>. */
  adaptersDataDir?: string;
  /** Never open the network; require cached community adapters. */
  offlineAdapters?: boolean;
  /** Injectable fetch used by the community-adapter installer. */
  adapterFetch?: AdapterFetch;
  /**
   * Creates the execution host for an installed community adapter. Defaults to
   * spawning this executable's `adapter-host --bundle` subprocess.
   */
  adapterHostFactory?: AdapterHostFactory;
};

const createServiceSchema = z.object({
  adapter: z.string().min(1),
  name: z.string().min(1).max(120),
  connection: z.record(z.unknown()).default({}),
});
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(256),
});

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Request could not be completed";
}
function status(error: unknown): 400 | 404 | 422 {
  const message = errorMessage(error);
  return message.startsWith("Unknown") ||
    message.startsWith("Service not found")
    ? 404
    : message.includes("Invalid") || message.includes("required")
      ? 422
      : 400;
}

function configuredConnection(
  service: ConfiguredService,
): Record<string, unknown> {
  return normalizeConnection(service.adapter, service.connection);
}
function rowEncrypted(row: UiServiceRow) {
  return {
    ciphertext: row.connection_ciphertext,
    iv: row.connection_iv,
    tag: row.connection_tag,
  };
}

function operationResponse(result: unknown): {
  data: unknown;
  nextCursor?: string;
  warnings?: string[];
  columns?: string[];
  folders?: string[];
} {
  if (result && typeof result === "object" && "items" in result) {
    const page = result as {
      items: unknown;
      nextCursor?: string;
      warnings?: string[];
      columns?: string[];
      folders?: string[];
    };
    return {
      data: page.items,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
      ...(page.warnings ? { warnings: page.warnings } : {}),
      ...(page.columns ? { columns: page.columns } : {}),
      ...(page.folders ? { folders: page.folders } : {}),
    };
  }
  return { data: result };
}

function sessionHash(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

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
  const registry = options.adapterRegistry ?? new AdapterRegistry();
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
  const baseAdapters = registry.list();

  /**
   * Verified artifacts for configured community adapters live beside the rest
   * of /data. Installation never mutates configuration; a failed download or
   * validation marks the adapter unavailable instead of blocking startup.
   */
  const externalAdapters = new ExternalAdapterManager({
    dataDir: options.adaptersDataDir ?? dataDir,
    fetch: options.adapterFetch,
    offline: options.offlineAdapters,
  });
  const adapterStatus = new Map<string, ReadinessCheck>();
  const defaultHostFactory: AdapterHostFactory = (_logicalId, installed) => {
    // Compiled binary: execPath re-enters dsui directly. Source checkout:
    // argv[1] is the entry script that owns command dispatch.
    const script = process.argv[1] ? resolveScript(process.argv[1]) : undefined;
    const selfScript =
      script && script !== resolveScript(process.execPath) ? script : undefined;
    return new ExternalAdapterHostClient({
      command: process.execPath,
      args: [
        ...(selfScript ? [selfScript] : []),
        "adapter-host",
        "--bundle",
        installed.bundlePath,
      ],
    });
  };
  const hostFactory = options.adapterHostFactory ?? defaultHostFactory;

  /** Overrides are re-applied and externals re-registered on every reload. */
  const syncAdapters = async (loaded: DsuiConfig) => {
    registry.reset(baseAdapters);
    adapterStatus.clear();
    for (const [id, override] of Object.entries(loaded.adapters ?? {}))
      if (!isCommunityAdapterSource(override))
        registry.applyMetadata(id, override);
    for (const [logicalId, source] of communityAdapterEntries(loaded)) {
      try {
        if (baseAdapters.some((adapter) => adapter.id === logicalId))
          throw new Error(
            "Community adapter id collides with a built-in adapter",
          );
        let installed = await externalAdapters.installedFor(source);
        installed ??= await externalAdapters.install(source);
        registry.register(
          externalAdapterDefinition(
            installed,
            hostFactory(logicalId, installed),
            logicalId,
          ),
        );
        adapterStatus.set(logicalId, {
          status: "ok",
          detail: `${installed.manifest.name} ${installed.manifest.version}`,
        });
      } catch (error) {
        adapterStatus.set(logicalId, {
          status: "unavailable",
          detail: errorMessage(error),
        });
      }
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
    await syncAdapters(loaded);
    config = loaded;
    return config;
  };
  const serviceSource = (
    id: string,
  ): {
    service: ConfiguredService | UiServiceRow;
    managedBy: "configuration" | "ui";
  } | null => {
    const configured = config.services.find((service) => service.id === id);
    if (configured) return { service: configured, managedBy: "configuration" };
    const stored = database.getUiService(id);
    return stored ? { service: stored, managedBy: "ui" } : null;
  };
  const connectionFor = (
    source: ReturnType<typeof serviceSource>,
  ): Record<string, unknown> => {
    if (!source) throw new Error("Service not found");
    return source.managedBy === "configuration"
      ? configuredConnection(source.service as ConfiguredService)
      : (cipher?.decrypt<Record<string, unknown>>(
          rowEncrypted(source.service as UiServiceRow),
        ) ??
          (() => {
            throw new Error(
              "DSUI_MASTER_KEY is required to read UI-managed services",
            );
          })());
  };
  const publicService = async (id: string): Promise<PublicService> => {
    const source = serviceSource(id);
    if (!source) throw new Error("Service not found");
    const adapter = registry.get(source.service.adapter);
    const connection = connectionFor(source);
    let health: PublicService["health"] = "unknown";
    let detail: string | undefined;
    let latencyMs: number | undefined;
    try {
      const instance = adapter.create(
        {},
        adapter.connectionSchema.parse(connection),
      );
      const checked = await instance.health();
      health = checked.status;
      detail = checked.detail;
      latencyMs = checked.latencyMs;
      await instance.close?.();
    } catch {
      health = "unavailable";
      detail = "Connection could not be verified";
    }
    return {
      id: source.service.id,
      name: source.service.name ?? adapter.metadata.name,
      adapter: adapter.id,
      category: adapter.metadata.category,
      endpoint: endpointFor(adapter.id, connection),
      health,
      detail,
      latencyMs,
      managedBy: source.managedBy,
      capabilities: adapter.capabilities.map((capability) => capability.id),
      ...(adapter.metadata.logo
        ? { logo: `/api/v1/adapters/${adapter.id}/logo` }
        : {}),
    };
  };
  const testConnection = async (
    adapterId: string,
    raw: Record<string, unknown>,
  ) => {
    const adapter = registry.get(adapterId);
    const connection = adapter.connectionSchema.parse(
      normalizeConnection(adapterId, raw),
    );
    const instance = adapter.create({}, connection);
    try {
      return await instance.health();
    } finally {
      await instance.close?.();
    }
  };
  const localPrincipal = (token: string): Principal | null => {
    const user = database.getSessionPrincipal(sessionHash(token));
    return user && ["owner", "admin", "operator", "viewer"].includes(user.role)
      ? { id: user.id, role: user.role as Principal["role"] }
      : null;
  };
  const issueSession = (userId: string): string => {
    const token = randomBytes(32).toString("base64url");
    const expires = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    database.createSession(sessionHash(token), userId, expires);
    return token;
  };
  const enterprisePrincipal = enterpriseAuth
    ? async (request: Request): Promise<{ id: string } | null> => {
        const session = await enterpriseAuth.api.getSession({
          headers: request.headers,
        });
        return session?.user?.id ? { id: session.user.id } : null;
      }
    : undefined;

  const app = new Hono();
  app.get("/health", (context) =>
    context.json({ status: "ok", version: "0.1.0" }),
  );
  app.get("/api/v1/health", (context) =>
    context.json({ status: "ok", authMode }),
  );
  if (enterpriseAuth) {
    // Better Auth receives the original Fetch Request, which preserves query
    // parameters, form posts, callback state, and all Set-Cookie headers for
    // OIDC and SAML flows.
    app.all("/api/auth/*", (context) =>
      enterpriseAuth.handler(context.req.raw),
    );
  }
  app.use("/api/v1/*", async (context, next) => {
    if (
      [
        "/api/v1/auth/mode",
        "/api/v1/auth/setup",
        "/api/v1/auth/login",
      ].includes(context.req.path)
    )
      return next();
    return authentication(
      authMode,
      localPrincipal,
      enterprisePrincipal,
      (userId) => database.getEnterpriseRole(userId),
    )(context, next);
  });
  app.get("/api/v1/auth/mode", (context) => context.json({ mode: authMode }));
  app.post("/api/v1/auth/setup", async (context) => {
    if (authMode !== "local")
      return context.json({ message: "Local authentication is disabled" }, 404);
    if (database.hasLocalUsers())
      return context.json({ message: "Owner account already exists" }, 409);
    try {
      const input = credentialsSchema.parse(await context.req.json());
      const id = randomUUID();
      database.createLocalUser({
        id,
        email: input.email,
        password_hash: await Bun.password.hash(input.password),
        role: "owner",
      });
      const token = issueSession(id);
      database.audit(id, "auth.setup", id);
      context.header(
        "Set-Cookie",
        `dsui_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
      );
      return context.json({ id, email: input.email, role: "owner" }, 201);
    } catch (error) {
      return context.json({ message: errorMessage(error) }, status(error));
    }
  });
  app.post("/api/v1/auth/login", async (context) => {
    if (authMode !== "local")
      return context.json({ message: "Local authentication is disabled" }, 404);
    try {
      const input = credentialsSchema.parse(await context.req.json());
      const user = database.getLocalUser(input.email);
      if (
        !user ||
        !(await Bun.password.verify(input.password, user.password_hash))
      )
        return context.json({ message: "Invalid email or password" }, 401);
      const token = issueSession(user.id);
      database.audit(user.id, "auth.login", user.id);
      context.header(
        "Set-Cookie",
        `dsui_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
      );
      return context.json({ id: user.id, email: user.email, role: user.role });
    } catch (error) {
      return context.json({ message: errorMessage(error) }, status(error));
    }
  });
  app.get("/api/v1/auth/me", (context) =>
    context.json(context.get("principal")),
  );
  app.post("/api/v1/auth/logout", (context) => {
    if (enterpriseAuth) {
      const url = new URL(context.req.raw.url);
      url.pathname = "/api/auth/sign-out";
      return enterpriseAuth.handler(
        new Request(url, {
          method: "POST",
          headers: context.req.raw.headers,
        }),
      );
    }
    const token = context.req
      .header("cookie")
      ?.match(/(?:^|;\s*)dsui_session=([^;]+)/)?.[1];
    if (token) database.deleteSession(sessionHash(decodeURIComponent(token)));
    context.header(
      "Set-Cookie",
      "dsui_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    );
    return context.body(null, 204);
  });
  app.get("/api/v1/adapters", (context) =>
    context.json(registry.list().map(publicAdapter)),
  );
  app.get("/api/v1/adapters/:id/logo", async (context) => {
    let source: string | undefined;
    try {
      source = registry.get(context.req.param("id")).metadata.logo;
    } catch {
      return context.json({ message: "Unknown adapter" }, 404);
    }
    if (!source) return context.json({ message: "Adapter has no logo" }, 404);
    if (httpUrl.test(source)) return context.redirect(source, 302);
    const contentType = LOGO_CONTENT_TYPES[extname(source).toLowerCase()];
    try {
      if (!contentType) throw new Error("Unsupported logo format");
      const file = await stat(source);
      if (!file.isFile() || file.size > MAX_LOGO_BYTES)
        throw new Error("Logo file is missing or too large");
      const bytes = await readFile(source);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "content-type": contentType,
          "cache-control": "public, max-age=300",
        },
      });
    } catch (error) {
      return context.json({ message: errorMessage(error) }, 404);
    }
  });
  app.get("/api/v1/services", async (context) => {
    try {
      await refreshConfig();
      return context.json(
        await Promise.all(
          [
            ...config.services.map((service) => service.id),
            ...database
              .listUiServices()
              .filter(
                (row) =>
                  !config.services.some((service) => service.id === row.id),
              )
              .map((row) => row.id),
          ].map(publicService),
        ),
      );
    } catch (error) {
      return context.json({ message: errorMessage(error) }, status(error));
    }
  });
  app.get("/api/v1/services/:id/manifest", async (context) => {
    try {
      await refreshConfig();
      const source = serviceSource(context.req.param("id"));
      if (!source) throw new Error("Service not found");
      const adapter = registry.get(source.service.adapter);
      return context.json({
        views: adapter.capabilities.map((capability) => ({
          id: capability.id,
          title: capability.view.title,
          capability: capability.id,
          renderer:
            capability.view.kind === "query"
              ? "query-workbench"
              : capability.view.kind,
          kind: capability.view.kind,
          description: capability.view.description,
          columns: (capability.view.columns ?? []).map((column) => ({
            id: column.id,
            label: column.label,
            format: column.format,
          })),
          actions: capability.view.actions ?? [],
          filters: capability.view.filters ?? [],
          detail: capability.view.detail,
          idField: capability.view.idField,
        })),
      });
    } catch (error) {
      return context.json({ message: errorMessage(error) }, status(error));
    }
  });
  app.post("/api/v1/services/test", async (context) => {
    try {
      const input = createServiceSchema.parse(await context.req.json());
      const health = await testConnection(input.adapter, input.connection);
      return context.json(health);
    } catch (error) {
      return context.json({ message: errorMessage(error) }, status(error));
    }
  });
  app.post("/api/v1/services", async (context) => {
    const principal = context.get("principal");
    if (!allowed(principal, "manage"))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const input = createServiceSchema.parse(await context.req.json());
      if (!cipher)
        throw new Error(
          "DSUI_MASTER_KEY is required to persist UI-managed connections",
        );
      const adapter = registry.get(input.adapter);
      const connection = adapter.connectionSchema.parse(
        normalizeConnection(input.adapter, input.connection),
      );
      const id = randomUUID();
      database.insertUiService(
        { id, name: input.name, adapter: input.adapter },
        cipher.encrypt(connection),
      );
      database.audit(principal.id, "service.create", id, {
        adapter: input.adapter,
      });
      return context.json(await publicService(id), 201);
    } catch (error) {
      return context.json({ message: errorMessage(error) }, status(error));
    }
  });
  app.post("/api/v1/services/:id/capabilities/:capability", async (context) => {
    const principal = context.get("principal");
    try {
      await refreshConfig();
      const source = serviceSource(context.req.param("id"));
      if (!source) throw new Error("Service not found");
      const adapter = registry.get(source.service.adapter);
      const capability = adapter.capabilities.find(
        (item) => item.id === context.req.param("capability"),
      );
      if (!capability) throw new Error("Unknown capability");
      if (!allowed(principal, capability.authorization))
        return context.json({ message: "Insufficient permission" }, 403);
      const connection = adapter.connectionSchema.parse(connectionFor(source));
      const instance = adapter.create(
        { signal: context.req.raw.signal },
        connection,
      );
      try {
        const result = await instance.execute(
          capability.id,
          await context.req.json().catch(() => ({})),
        );
        database.audit(principal.id, "capability.execute", source.service.id, {
          capability: capability.id,
        });
        return context.json(operationResponse(result));
      } finally {
        await instance.close?.();
      }
    } catch (error) {
      return context.json({ message: errorMessage(error) }, status(error));
    }
  });
  const webRoot = options.webRoot ?? process.env.DSUI_WEB_ROOT;
  if (webRoot && existsSync(webRoot)) {
    app.use("/*", serveStatic({ root: webRoot }));
    app.get("*", serveStatic({ path: join(webRoot, "index.html") }));
  }
  return {
    app,
    database,
    registry,
    refreshConfig,
    close: () => database.close(),
  };
}
