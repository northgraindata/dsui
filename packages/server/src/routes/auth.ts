import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Hono } from "hono";
import { z } from "zod";
import { type AuthMode, authentication, type Principal } from "../auth.js";
import type { DsuiDatabase } from "../db/database.js";
import { errorMessage, httpStatus } from "./errors.js";

export type EnterpriseAuthKit =
  | {
      handler(request: Request): Promise<Response> | Response;
      api: {
        getSession(options: {
          headers: Headers;
        }): Promise<{ user?: { id?: string } | null } | null>;
      };
    }
  | undefined;

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(256),
});

function sessionHash(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function issueSession(database: DsuiDatabase, userId: string): string {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  database.createSession(sessionHash(token), userId, expires);
  return token;
}

export function localPrincipal(
  database: DsuiDatabase,
  token: string,
): Principal | null {
  const user = database.getSessionPrincipal(sessionHash(token));
  return user && ["owner", "admin", "operator", "viewer"].includes(user.role)
    ? { id: user.id, role: user.role as Principal["role"] }
    : null;
}

export interface AuthRouteDeps {
  database: DsuiDatabase;
  authMode: AuthMode;
  enterpriseAuth: EnterpriseAuthKit;
  enterprisePrincipal?: (request: Request) => Promise<{ id: string } | null>;
  enterpriseRole?: (userId: string) => Principal["role"] | null;
}

export function registerAuthMiddleware(
  app: Hono,
  deps: Pick<
    AuthRouteDeps,
    | "database"
    | "authMode"
    | "enterpriseAuth"
    | "enterprisePrincipal"
    | "enterpriseRole"
  >,
): void {
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
      deps.authMode,
      (token) => localPrincipal(deps.database, token),
      deps.enterprisePrincipal,
      deps.enterpriseRole,
    )(context, next);
  });
}

export function registerAuthRoutes(app: Hono, deps: AuthRouteDeps): void {
  registerAuthMiddleware(app, deps);

  app.get("/api/v1/auth/mode", (context) =>
    context.json({ mode: deps.authMode }),
  );
  app.post("/api/v1/auth/setup", async (context) => {
    if (deps.authMode !== "local")
      return context.json({ message: "Local authentication is disabled" }, 404);
    if (deps.database.hasLocalUsers())
      return context.json({ message: "Owner account already exists" }, 409);
    try {
      const input = credentialsSchema.parse(await context.req.json());
      const id = randomUUID();
      deps.database.createLocalUser({
        id,
        email: input.email,
        password_hash: await Bun.password.hash(input.password),
        role: "owner",
      });
      const token = issueSession(deps.database, id);
      deps.database.audit(id, "auth.setup", id);
      context.header(
        "Set-Cookie",
        `dsui_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
      );
      return context.json({ id, email: input.email, role: "owner" }, 201);
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });
  app.post("/api/v1/auth/login", async (context) => {
    if (deps.authMode !== "local")
      return context.json({ message: "Local authentication is disabled" }, 404);
    try {
      const input = credentialsSchema.parse(await context.req.json());
      const user = deps.database.getLocalUser(input.email);
      if (
        !user ||
        !(await Bun.password.verify(input.password, user.password_hash))
      )
        return context.json({ message: "Invalid email or password" }, 401);
      const token = issueSession(deps.database, user.id);
      deps.database.audit(user.id, "auth.login", user.id);
      context.header(
        "Set-Cookie",
        `dsui_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
      );
      return context.json({ id: user.id, email: user.email, role: user.role });
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });
  app.get("/api/v1/auth/me", (context) =>
    context.json(context.get("principal")),
  );
  app.post("/api/v1/auth/logout", (context) => {
    if (deps.enterpriseAuth) {
      const url = new URL(context.req.raw.url);
      url.pathname = "/api/auth/sign-out";
      return deps.enterpriseAuth.handler(
        new Request(url, {
          method: "POST",
          headers: context.req.raw.headers,
        }),
      );
    }
    const token = context.req
      .header("cookie")
      ?.match(/(?:^|;\s*)dsui_session=([^;]+)/)?.[1];
    if (token)
      deps.database.deleteSession(sessionHash(decodeURIComponent(token)));
    context.header(
      "Set-Cookie",
      "dsui_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    );
    return context.body(null, 204);
  });
}
