import type { MiddlewareHandler } from "hono";

/**
 * Authorization primitives for OSS DSUI.
 *
 * OSS has no identity provider. It is a developer tool: a single operator runs
 * it locally against their own pipelines, and an installation that needs
 * authentication puts DSUI behind a reverse proxy that handles it. This module
 * therefore owns only the *authorization vocabulary* — the roles and the
 * permission each role implies — and never the question of who is calling.
 *
 * Identity is a plugin concern. A plugin registers an authentication provider
 * and DSUI asks it for a `PluginPrincipal`; a first-party RBAC plugin narrows
 * what that principal may do.
 */

export type Role = "owner" | "admin" | "operator" | "viewer";
export type Permission = "inspect" | "execute" | "manage";

/**
 * The principal OSS assumes when no authentication plugin is installed.
 *
 * It is a fixed local identity with full permissions, matching the previous
 * unauthenticated mode. Requests are not attributable to a person, which is
 * why this is only correct for the single-operator deployment OSS targets.
 */
export const LOCAL_PRINCIPAL_ID = "local";

export type Principal = {
  id: string;
  role: Role;
  /** Plugin-defined context; never interpreted by the host. */
  attributes?: Readonly<Record<string, unknown>>;
};

/**
 * Permission grants per role.
 *
 * `viewer` is read-only, `operator` adds execution, and `admin`/`owner` add
 * configuration changes. A plugin's `authorize` may narrow these grants but
 * never widen them, so this table is a hard ceiling for every install.
 */
const grants: Record<Role, readonly Permission[]> = {
  owner: ["inspect", "execute", "manage"],
  admin: ["inspect", "execute", "manage"],
  operator: ["inspect", "execute"],
  viewer: ["inspect"],
};

export function allowed(principal: Principal, permission: Permission): boolean {
  return grants[principal.role]?.includes(permission) ?? false;
}

declare module "hono" {
  interface ContextVariableMap {
    principal: Principal;
  }
}

/**
 * Assigns the local principal to every request.
 *
 * With no authentication plugin installed there is nothing to verify, so the
 * request proceeds as the local operator. When an authentication plugin is
 * active the plugin runtime resolves the real principal instead; this
 * middleware is not installed in that case.
 */
export function localPrincipalMiddleware(): MiddlewareHandler {
  return async (context, next) => {
    context.set("principal", {
      id: LOCAL_PRINCIPAL_ID,
      role: "owner",
    });
    return next();
  };
}
