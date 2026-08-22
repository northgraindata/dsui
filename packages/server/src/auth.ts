import { type OIDCConfig, type SAMLConfig, sso } from "@better-auth/sso";
import { betterAuth } from "better-auth";
import type { MiddlewareHandler } from "hono";

export type AuthMode = "none" | "local" | "enterprise";
export type Role = "owner" | "admin" | "operator" | "viewer";
export type Principal = { id: string; role: Role };
export type EnterpriseProvider = {
  providerId: string;
  domain: string;
  oidcConfig?: OIDCConfig;
  samlConfig?: SAMLConfig;
};
export type EnterpriseAuthOptions = {
  database: object;
  baseURL: string;
  secret: string;
  trustedOrigins: string[];
  providers: EnterpriseProvider[];
  provisionMember: (userId: string) => void;
};

declare module "hono" {
  interface ContextVariableMap {
    principal: Principal;
  }
}

const permissions: Record<Role, readonly ("inspect" | "execute" | "manage")[]> =
  {
    owner: ["inspect", "execute", "manage"],
    admin: ["inspect", "execute", "manage"],
    operator: ["inspect", "execute"],
    viewer: ["inspect"],
  };

/**
 * Builds the only Better Auth instance used by an enterprise installation.
 *
 * @better-auth/sso persists provider configuration as plaintext JSON. DSUI
 * therefore supplies encrypted, server-side records as defaultSSO and disables
 * the plugin's persisted-provider registration API (providersLimit: 0).
 */
export function createEnterpriseAuth(options: EnterpriseAuthOptions) {
  const secure = new URL(options.baseURL).protocol === "https:";
  return betterAuth({
    appName: "DSUI",
    baseURL: options.baseURL,
    basePath: "/api/auth",
    secret: options.secret,
    database: options.database as never,
    trustedOrigins: options.trustedOrigins,
    useSecureCookies: secure,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
    },
    plugins: [
      sso({
        defaultSSO: options.providers,
        // Provider mutations would store client secrets and SAML private keys
        // in the plugin's plaintext ssoProvider table. DSUI configures them
        // through enterprise_sso_providers, encrypted with DSUI_MASTER_KEY.
        providersLimit: 0,
        provisionUser: async ({ user }) => {
          // An authenticated SSO identity receives no elevated access merely
          // by being the first person to sign in.
          options.provisionMember(user.id);
        },
      }),
    ],
  });
}

type EnterpriseSessionResolver = (
  request: Request,
) => Promise<{ id: string } | null>;

/** Authentication middleware for DSUI API routes. */
export function authentication(
  mode: AuthMode,
  resolveLocalSession?: (token: string) => Principal | null,
  resolveEnterpriseSession?: EnterpriseSessionResolver,
  resolveEnterpriseRole?: (userId: string) => Role | null,
): MiddlewareHandler {
  return async (context, next) => {
    if (mode === "none") {
      context.set("principal", { id: "local", role: "owner" });
      return next();
    }
    if (mode === "local") {
      const token = context.req
        .header("cookie")
        ?.match(/(?:^|;\s*)dsui_session=([^;]+)/)?.[1];
      const principal = token
        ? resolveLocalSession?.(decodeURIComponent(token))
        : null;
      if (!principal)
        return context.json({ message: "Authentication required" }, 401);
      context.set("principal", principal);
      return next();
    }
    // Enterprise identities come exclusively from Better Auth's signed,
    // server-side session. Never accept an identity or role from request
    // headers: those are trivially spoofed when DSUI is directly reachable.
    try {
      const session = await resolveEnterpriseSession?.(context.req.raw);
      const role = session ? resolveEnterpriseRole?.(session.id) : null;
      if (!session || !role)
        return context.json({ message: "Authentication required" }, 401);
      context.set("principal", { id: session.id, role });
      return next();
    } catch {
      return context.json({ message: "Authentication required" }, 401);
    }
  };
}

export function allowed(
  principal: Principal,
  permission: "inspect" | "execute" | "manage",
): boolean {
  return permissions[principal.role].includes(permission);
}
