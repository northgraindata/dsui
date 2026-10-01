import type { Database, SQLQueryBindings } from "bun:sqlite";
import { chmodSync } from "node:fs";
import {
  definePlugin,
  type PluginContext,
  type PluginPrincipal,
  type PluginRole,
} from "@northgraindata/dsui-plugin-sdk";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { z } from "zod";
import { BASE_PATH } from "./base-path.js";
import { loginPage } from "./pages/login.js";

/** Mirrors the host's roles, which are the ceiling on what a principal may do. */
const roleSchema = z.enum(["owner", "admin", "operator", "viewer"]);

/**
 * Where the host mounts this plugin's identity endpoints.
 *
 * Shared by the page the browser form posts to and by Better Auth itself; the
 * two have to agree or every request 404s.
 */

const configSchema = z.object({
  /**
   * Better Auth signing secret. Interpolate it from the environment —
   * `secret: "${DSUI_AUTH_SECRET}"` — to keep it out of the file. Generated and
   * persisted on first run when absent, so a local install needs no setup.
   */
  secret: z.string().min(1).optional(),
  /**
   * Public origin, when DSUI sits behind a proxy that hides its own address.
   * Omitted, Better Auth derives it from the incoming request.
   */
  baseURL: z.string().optional(),
  /** Extra origins allowed to call the identity endpoints. */
  trustedOrigins: z.array(z.string()).default([]),
  registration: z
    .object({
      /**
       * Whether anyone may create an account.
       *
       * This is the switch that keeps DSUI off the public internet: off by
       * default, so installing the plugin does not by itself open sign-up.
       */
      enabled: z.boolean().default(false),
      minPasswordLength: z.number().int().min(8).default(12),
    })
    .default({}),
  session: z
    .object({ maxAgeDays: z.number().int().positive().default(30) })
    .default({}),
  /**
   * The first account, created when the database has no principals.
   *
   * With registration closed this is the only way in, so it is how an operator
   * installs the plugin without locking themselves out.
   */
  bootstrap: z
    .object({
      email: z.string().email(),
      password: z.string().min(12),
      /** Better Auth requires a display name; the email local part is a fine default. */
      name: z.string().min(1).optional(),
      role: roleSchema.default("owner"),
    })
    .optional(),
});

type Config = z.output<typeof configSchema>;

type Logger = PluginContext<Config>["logger"];

/**
 * This plugin's own tables, on top of Better Auth's.
 *
 * Better Auth answers "who is this". It does not answer "which team may see
 * which service", because that is a question about DSUI's own resources. Its
 * `organization` plugin models permissions per organization, which would mean
 * translating between two permission models on every request; these tables keep
 * the grant in DSUI's own vocabulary.
 */
function migrateOwnTables(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS plugin_secrets (
      name TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS principals (
      user_id TEXT PRIMARY KEY,
      role TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS team_members (
      team_id TEXT NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      PRIMARY KEY (team_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS service_grants (
      team_id TEXT NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
      service_id TEXT NOT NULL,
      PRIMARY KEY (team_id, service_id)
    );
    CREATE INDEX IF NOT EXISTS service_grants_by_service
      ON service_grants (service_id);
  `);
}

function readSecret(
  database: Database,
  configured: string | undefined,
  logger: Logger,
): string {
  if (configured) return configured;
  const existing = database
    .query<{ value: string }, [string]>(
      "SELECT value FROM plugin_secrets WHERE name = 'auth'",
    )
    .get("auth");
  if (existing) return existing.value;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Buffer.from(bytes).toString("base64url");
  database.run("INSERT INTO plugin_secrets (name, value) VALUES ('auth', ?)", [
    secret,
  ]);
  // The signing secret lives in this file, so the file is credential material.
  chmodSync(database.filename, 0o600);
  logger.info("generated a signing secret");
  return secret;
}

/**
 * Builds the plugin.
 *
 * A factory rather than a bare object literal because `setup` and `start` must
 * share one database and one Better Auth instance. A factory keeps that state
 * inside the plugin instance instead of in module scope, where two runtimes in
 * the same process would collide.
 */
function createAuthProPlugin() {
  let database: Database | undefined;
  let auth: ReturnType<typeof betterAuth> | undefined;

  const requireDatabase = (): Database => {
    if (!database) throw new Error("Auth plugin has not started");
    return database;
  };

  const principalFor = (userId: string): PluginPrincipal => {
    const db = requireDatabase();
    const row = db
      .query<{ role: string }, [string]>(
        "SELECT role FROM principals WHERE user_id = ?",
      )
      .get(userId);
    const teamIds = db
      .query<{ team_id: string }, [string]>(
        "SELECT team_id FROM team_members WHERE user_id = ? ORDER BY team_id",
      )
      .all(userId)
      .map((team) => team.team_id);
    return {
      id: userId,
      role: (row?.role as PluginRole | undefined) ?? "viewer",
      attributes: { teamIds },
    };
  };

  const teamIdsOf = (principal: PluginPrincipal): string[] => {
    const teamIds = principal.attributes?.teamIds;
    return Array.isArray(teamIds)
      ? teamIds.filter((id): id is string => typeof id === "string")
      : [];
  };

  return definePlugin<Config>({
    metadata: {
      id: "auth-pro",
      name: "DSUI Auth (Pro)",
      version: "0.1.0",
      apiVersion: 1,
      security: true,
    },
    configSchema,

    setup(registry, config) {
      registry.page(loginPage, {
        id: "login",
        title: "Sign in",
        public: true,
        shell: "bare",
      });

      registry.authentication({
        async authenticate(request) {
          const session = await auth?.api
            .getSession({ headers: request.headers })
            .catch(() => null);
          const userId = session?.user?.id;
          return userId ? principalFor(userId) : null;
        },
        routes: (request) => {
          if (!auth) throw new Error("Auth plugin has not started");
          return auth.handler(request);
        },
      });

      registry.authorization({
        authorize({ principal, resource }) {
          // The host applies the role's permission ceiling first, so this only
          // decides resource-level access: which services a team may see.
          if (resource?.type !== "service") return true;
          if (principal.role === "owner" || principal.role === "admin")
            return true;
          const teamIds = teamIdsOf(principal);
          if (teamIds.length === 0) return false;
          const row = requireDatabase()
            .query<{ n: number }, SQLQueryBindings[]>(
              `SELECT COUNT(*) AS n FROM service_grants
               WHERE service_id = ?
                 AND team_id IN (${teamIds.map(() => "?").join(", ")})`,
            )
            .get(...[resource.id, ...teamIds]);
          return (row?.n ?? 0) > 0;
        },
      });

      const teamId = z.string().min(1);
      const serviceId = z.string().min(1);

      registry.procedure({
        id: "teams",
        permission: "manage",
        input: z.object({}),
        output: z.object({
          items: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              members: z.number().int(),
              services: z.array(z.string()),
            }),
          ),
        }),
        handler: () => {
          const db = requireDatabase();
          const teams = db
            .query<{ id: string; name: string }, []>(
              "SELECT id, name FROM teams ORDER BY name ASC",
            )
            .all();
          const scalar = (sql: string, id: string): number =>
            db.query<{ n: number }, [string]>(sql).get(id)?.n ?? 0;
          return {
            items: teams.map((team) => ({
              id: team.id,
              name: team.name,
              members: scalar(
                "SELECT COUNT(*) AS n FROM team_members WHERE team_id = ?",
                team.id,
              ),
              services: db
                .query<{ service_id: string }, [string]>(
                  "SELECT service_id FROM service_grants WHERE team_id = ? ORDER BY service_id",
                )
                .all(team.id)
                .map((row) => row.service_id),
            })),
          };
        },
      });

      registry.procedure({
        id: "create-team",
        permission: "manage",
        input: z.object({ id: teamId, name: z.string().min(1) }),
        output: z.object({ id: z.string() }),
        handler: (context, input) => {
          requireDatabase().run(
            "INSERT INTO teams (id, name, created_at) VALUES (?, ?, ?)",
            [input.id, input.name, new Date().toISOString()],
          );
          context.logger.info("team created", { id: input.id });
          return { id: input.id };
        },
      });

      registry.procedure({
        id: "add-member",
        permission: "manage",
        input: z.object({ teamId, userId: z.string().min(1) }),
        output: z.object({ added: z.literal(true) }),
        handler: (_, input) => {
          requireDatabase().run(
            "INSERT OR IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)",
            [input.teamId, input.userId],
          );
          return { added: true as const };
        },
      });

      registry.procedure({
        id: "remove-member",
        permission: "manage",
        input: z.object({ teamId, userId: z.string().min(1) }),
        output: z.object({ removed: z.literal(true) }),
        handler: (_, input) => {
          requireDatabase().run(
            "DELETE FROM team_members WHERE team_id = ? AND user_id = ?",
            [input.teamId, input.userId],
          );
          return { removed: true as const };
        },
      });

      registry.procedure({
        id: "grant-service",
        permission: "manage",
        input: z.object({ teamId, serviceId }),
        output: z.object({ granted: z.literal(true) }),
        handler: async (context, input) => {
          // Checked against the host catalog so a typo fails loudly instead of
          // granting a service that does not exist and never matching.
          const service = await context.services.get(input.serviceId);
          if (!service) throw new Error(`Unknown service "${input.serviceId}"`);
          requireDatabase().run(
            "INSERT OR IGNORE INTO service_grants (team_id, service_id) VALUES (?, ?)",
            [input.teamId, input.serviceId],
          );
          context.logger.info("service granted", input);
          return { granted: true as const };
        },
      });

      registry.procedure({
        id: "revoke-service",
        permission: "manage",
        input: z.object({ teamId, serviceId }),
        output: z.object({ revoked: z.literal(true) }),
        handler: (_, input) => {
          requireDatabase().run(
            "DELETE FROM service_grants WHERE team_id = ? AND service_id = ?",
            [input.teamId, input.serviceId],
          );
          return { revoked: true as const };
        },
      });

      registry.procedure({
        id: "set-role",
        permission: "manage",
        input: z.object({ userId: z.string().min(1), role: roleSchema }),
        output: z.object({ role: roleSchema }),
        handler: (_, input) => {
          requireDatabase().run(
            `INSERT INTO principals (user_id, role) VALUES (?, ?)
             ON CONFLICT (user_id) DO UPDATE SET role = excluded.role`,
            [input.userId, input.role],
          );
          return { role: input.role };
        },
      });
    },

    async start({ storage, logger, config }) {
      database = storage.openDatabase("auth");
      migrateOwnTables(database);
      const secret = readSecret(database, config.secret, logger);

      // Held as a value so the migration step below can run before anything
      // initialises Better Auth's context. Better Auth inspects the schema when
      // its context is first built, so migrating afterwards makes a fresh
      // install log a schema mismatch that is not really there.
      // Typed as BetterAuthOptions so the instance, the migration call and
      // the plugin all agree on one shape.
      const options: BetterAuthOptions = {
        appName: "DSUI",
        secret,
        // Must match the prefix the host mounts at, or Better Auth never sees
        // past the plugin segment and answers 404 to every request.
        basePath: BASE_PATH,
        ...(config.baseURL ? { baseURL: config.baseURL } : {}),
        database,
        emailAndPassword: {
          enabled: true,
          // The registration switch. With it off Better Auth refuses sign-up,
          // so installing the plugin does not by itself open DSUI to anyone.
          disableSignUp: !config.registration.enabled,
          minPasswordLength: config.registration.minPasswordLength,
          requireEmailVerification: false,
          autoSignIn: true,
        },
        session: {
          expiresIn: config.session.maxAgeDays * 24 * 60 * 60,
          updateAge: 24 * 60 * 60,
        },
        ...(config.trustedOrigins.length
          ? { trustedOrigins: config.trustedOrigins }
          : {}),
        databaseHooks: {
          user: {
            create: {
              after: async (user: { id: string }) => {
                // A new account can see nothing until an operator grants it a
                // role and a team. Closing registration does not mean a
                // stranger can look around.
                database?.run(
                  "INSERT OR IGNORE INTO principals (user_id, role) VALUES (?, 'viewer')",
                  [user.id],
                );
              },
            },
          },
        },
      };

      // Better Auth owns the shape of its own tables; asking it for the plan
      // keeps the schema in step with the installed version instead of pinning
      // SQL here that would silently rot.
      const { runMigrations } = await getMigrations(options);
      await runMigrations();

      auth = betterAuth(options);

      await bootstrapOwner(database, auth, config, logger);
      logger.info("authentication ready", {
        registration: config.registration.enabled,
      });
    },
  });
}

/**
 * Creates the first account when the database has no principals.
 *
 * Written through Better Auth's internal adapter rather than its sign-up
 * endpoint, because that endpoint is exactly what the registration switch turns
 * off — with registration closed, it is the only way in, so it has to work
 * anyway. Idempotent: once a principal exists this does nothing, so a restart
 * never resurrects a bootstrap account.
 */
async function bootstrapOwner(
  database: Database,
  auth: ReturnType<typeof betterAuth>,
  config: Config,
  logger: Logger,
): Promise<void> {
  if (!config.bootstrap) return;
  const existing = database
    .query<{ n: number }, []>("SELECT COUNT(*) AS n FROM principals")
    .get();
  if ((existing?.n ?? 0) > 0) return;

  const { email, password } = config.bootstrap;
  const name = config.bootstrap.name ?? email.split("@")[0] ?? email;
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser(
    { email, name, emailVerified: true },
    // Declares how this account came into being, which is what an operator's
    // provisioning policy is written against.
    { method: "email-password" },
  );
  await context.internalAdapter.createAccount({
    userId: user.id,
    accountId: user.id,
    providerId: "credential",
    password: await context.password.hash(password),
  });
  database.run(
    `INSERT INTO principals (user_id, role) VALUES (?, ?)
     ON CONFLICT (user_id) DO UPDATE SET role = excluded.role`,
    [user.id, config.bootstrap.role],
  );
  logger.info("bootstrap account created", { role: config.bootstrap.role });
}

export default createAuthProPlugin();
