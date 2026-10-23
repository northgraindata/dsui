import type { Database } from "bun:sqlite";
import { createHash, randomUUID } from "node:crypto";
import {
  type ExecutionGrant,
  type ExecutionRequest,
  type ExecutionTarget,
  type PluginExecution,
  type PluginPrincipal,
  PluginRequestError,
  type PluginServiceCatalog,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import Ajv, { type ValidateFunction } from "ajv";

// Existing host permission tiers only; provider-owned teams belong in audience claims.
const principalSchema = z.object({
  id: z.string(),
  role: z.enum(["owner", "admin", "operator", "viewer"]),
  attributes: z.record(z.unknown()).optional(),
});
const targetSchema = z
  .object({
    serviceId: z.string().min(1),
    kind: z.enum(["resource", "action"]),
    id: z.string().min(1),
    inputSchema: z.record(z.unknown()).optional(),
  })
  .strict();
export const grantSchema = z
  .object({
    id: z.string().min(1).max(120),
    subject: z.string().min(1).max(120),
    revision: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    operationIds: z.array(z.string().min(1)).min(1).max(200),
    targets: z.array(targetSchema).max(200),
    executorId: z.string().min(1),
    expiresAt: z.number().int(),
    audience: z
      .object({
        roles: z.array(principalSchema.shape.role).optional(),
        principalIds: z.array(z.string()).optional(),
        claims: z.record(z.array(z.string())).optional(),
      })
      .strict(),
  })
  .strict();
const requestSchema = z
  .object({
    subject: grantSchema.shape.subject,
    revision: grantSchema.shape.revision,
    operationId: z.string().min(1),
    targets: grantSchema.shape.targets,
    grantId: z.string().optional(),
    continuationId: z.string().uuid().optional(),
  })
  .strict();
const continuationSchema = z.object({
  actorId: z.string(),
  local: z.boolean(),
  request: requestSchema.omit({ continuationId: true }),
  expiresAt: z.number(),
});

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => {
        if (a === b) return 0;
        return a < b ? -1 : 1;
      })
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function audienceAllows(
  principal: PluginPrincipal,
  audience: ExecutionGrant["audience"],
): boolean {
  const { roles, principalIds, claims } = audience;
  if (
    !roles?.length &&
    !principalIds?.length &&
    !Object.keys(claims ?? {}).length
  )
    return false;
  if (roles && !roles.includes(principal.role)) return false;
  if (principalIds && !principalIds.includes(principal.id)) return false;
  return Object.entries(claims ?? {}).every(([key, permitted]) => {
    const value = principal.attributes?.[key];
    return Array.isArray(value)
      ? value.some(
          (item) => typeof item === "string" && permitted.includes(item),
        )
      : typeof value === "string" && permitted.includes(value);
  });
}
type Hooks = {
  principal(): PluginPrincipal | null;
  authenticated(): boolean;
  canResolve(): boolean;
  canDelegate(): boolean;
  resolve(id: string, execution: boolean): Promise<PluginPrincipal | null>;
  authorize(
    principal: PluginPrincipal,
    permission: "inspect" | "execute" | "manage",
    resource?: {
      type: "service" | "plugin";
      id: string;
      actionId?: string;
      actionInput?: unknown;
    },
  ): Promise<boolean>;
  invoke<T>(
    principal: PluginPrincipal,
    actor: string,
    work: () => Promise<T>,
    check?: () => Promise<void>,
  ): Promise<T>;
  services: PluginServiceCatalog;
  audit(actor: string, action: string, target: string): void;
};

/** Authority persists in host-owned storage, outside a plugin's editable state. */
export class ExecutionService {
  private configurationValid = true;
  private readonly configured = new Map<string, ExecutionGrant>();
  private readonly checks = new Map<string, ValidateFunction>();
  private readonly validators = new Ajv({
    strict: true,
    allErrors: false,
    validateFormats: false,
    ownProperties: true,
  });
  constructor(
    private readonly db: Database,
    private readonly hooks: Hooks,
  ) {
    db.exec(`CREATE TABLE IF NOT EXISTS grants(plugin_id TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(plugin_id,id));
      CREATE TABLE IF NOT EXISTS continuations(id TEXT PRIMARY KEY,plugin_id TEXT NOT NULL,data TEXT NOT NULL,expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS continuations_authority ON continuations(plugin_id,json_extract(data,'$.authorityKey'),expires_at);`);
  }
  configure(grants: Record<string, readonly ExecutionGrant[]>) {
    this.configurationValid = false;
    this.configured.clear();
    for (const [pluginId, entries] of Object.entries(grants))
      for (const input of entries) {
        const grant = grantSchema.parse(input);
        const key = `${pluginId}/${grant.id}`;
        if (this.configured.has(key))
          throw new Error("Duplicate configured execution grant");
        for (const target of grant.targets)
          if (target.inputSchema) this.checkSchema(target.inputSchema);
        this.db
          .query("DELETE FROM grants WHERE plugin_id=? AND id=?")
          .run(pluginId, grant.id);
        this.configured.set(key, grant);
      }
    this.configurationValid = true;
  }
  forPlugin(pluginId: string): PluginExecution {
    return {
      identity: () => ({
        authenticated: this.hooks.authenticated(),
        revalidation: this.hooks.canResolve(),
        delegation: this.hooks.canDelegate(),
      }),
      validateGrant: async (input) => {
        await this.requireGrantManagement(pluginId);
        const request = requestSchema.parse(input);
        const row = request.grantId
          ? this.db
              .query<{ data: string }, [string, string]>(
                "SELECT data FROM grants WHERE plugin_id=? AND id=?",
              )
              .get(pluginId, request.grantId)
          : null;
        const grant =
          this.configured.get(`${pluginId}/${request.grantId}`) ??
          (row ? grantSchema.parse(JSON.parse(row.data)) : null);
        if (
          !grant ||
          grant.subject !== request.subject ||
          grant.revision !== request.revision ||
          grant.expiresAt <= Date.now() ||
          !grant.operationIds.includes(request.operationId) ||
          canonical(grant.targets) !== canonical(request.targets)
        )
          throw new PluginRequestError("No matching execution grant", 403);
        const executor = await this.hooks.resolve(grant.executorId, true);
        if (!executor || !["viewer", "operator"].includes(executor.role))
          throw new PluginRequestError(
            "Execution identity is unavailable",
            403,
          );
        for (const target of grant.targets)
          if (
            !(await this.hooks.authorize(
              executor,
              target.kind === "action" ? "execute" : "inspect",
              {
                type: "service",
                id: target.serviceId,
                ...(target.kind === "action" ? { actionId: target.id } : {}),
              },
            ))
          )
            throw new PluginRequestError(
              "Execution identity service access was revoked",
              403,
            );
      },
      approve: async (input) => {
        const manager = await this.requireGrantManagement(pluginId);
        const grant = grantSchema.parse(input);
        if (this.configured.has(`${pluginId}/${grant.id}`))
          throw new PluginRequestError(
            "Grant is managed in configuration",
            409,
          );
        if (
          grant.expiresAt <= Date.now() ||
          grant.expiresAt > Date.now() + 7 * 86400000
        )
          throw new PluginRequestError(
            "Grant expiry must be within seven days",
            422,
          );
        if (!this.hooks.canDelegate())
          throw new PluginRequestError(
            "Execution identity resolution is unavailable",
            403,
          );
        const executor = await this.hooks.resolve(grant.executorId, true);
        if (!executor || !["viewer", "operator"].includes(executor.role))
          throw new PluginRequestError(
            "A noninteractive viewer/operator identity is required",
            403,
          );
        for (const target of grant.targets) {
          if (target.inputSchema) this.checkSchema(target.inputSchema);
          if (
            !(await this.hooks.authorize(
              executor,
              target.kind === "action" ? "execute" : "inspect",
              {
                type: "service",
                id: target.serviceId,
                ...(target.kind === "action" ? { actionId: target.id } : {}),
              },
            ))
          )
            throw new PluginRequestError(
              "Executor cannot access a declared target",
              403,
            );
        }
        this.db
          .query(
            "INSERT INTO grants VALUES(?,?,?) ON CONFLICT(plugin_id,id) DO UPDATE SET data=excluded.data",
          )
          .run(pluginId, grant.id, JSON.stringify(grant));
        this.hooks.audit(
          manager.id,
          "execution.grant.approve",
          `${pluginId}/${grant.id}/${grant.revision}`,
        );
      },
      revoke: async (id) => {
        const manager = await this.requireGrantManagement(pluginId);
        if (this.configured.has(`${pluginId}/${id}`))
          throw new PluginRequestError(
            "Grant is managed in configuration",
            409,
          );
        this.db
          .query("DELETE FROM grants WHERE plugin_id=? AND id=?")
          .run(pluginId, id);
        this.hooks.audit(
          manager.id,
          "execution.grant.revoke",
          `${pluginId}/${id}`,
        );
      },
      open: async (input) => {
        if (!this.configurationValid)
          throw new PluginRequestError(
            "Execution configuration is invalid",
            403,
          );
        const request = requestSchema.parse(input);
        for (const target of request.targets)
          if (target.inputSchema) this.checkSchema(target.inputSchema);
        let actor = this.hooks.principal();
        let local = !this.hooks.authenticated();
        if (request.continuationId) {
          const row = this.db
            .query<{ data: string }, [string, string, number]>(
              "SELECT data FROM continuations WHERE id=? AND plugin_id=? AND expires_at>?",
            )
            .get(request.continuationId, pluginId, Date.now());
          if (!row)
            throw new PluginRequestError(
              "Execution continuation is unavailable",
              403,
            );
          const saved = continuationSchema.parse(JSON.parse(row.data));
          const { continuationId: _id, ...identity } = request;
          if (canonical(identity) !== canonical(saved.request))
            throw new PluginRequestError(
              "Execution continuation does not match this request",
              403,
            );
          local = saved.local;
          actor =
            local && !this.hooks.authenticated()
              ? { id: "local", role: "owner" }
              : await this.hooks.resolve(saved.actorId, false);
        }
        if (!actor)
          throw new PluginRequestError(
            "Current execution identity is unavailable",
            403,
          );
        const actorId = actor.id;
        let closed = false;
        let currentActor = actor;
        let currentExecutor = actor;
        const revalidate = async () => {
          if (!this.configurationValid)
            throw new PluginRequestError(
              "Execution configuration is invalid",
              403,
            );
          if (closed)
            throw new PluginRequestError("Execution scope is closed", 403);
          const current =
            local && !this.hooks.authenticated()
              ? actor
              : await this.hooks.resolve(actorId, false);
          if (
            !current ||
            !(await this.hooks.authorize(current, "inspect", {
              type: "plugin",
              id: pluginId,
            }))
          )
            throw new PluginRequestError(
              "Execution identity access was revoked",
              403,
            );
          let executor = current;
          if (request.grantId) {
            const row = this.db
              .query<{ data: string }, [string, string]>(
                "SELECT data FROM grants WHERE plugin_id=? AND id=?",
              )
              .get(pluginId, request.grantId);
            const grant =
              this.configured.get(`${pluginId}/${request.grantId}`) ??
              (row ? grantSchema.parse(JSON.parse(row.data)) : null);
            if (
              local ||
              !grant ||
              grant.expiresAt <= Date.now() ||
              grant.subject !== request.subject ||
              grant.revision !== request.revision ||
              !grant.operationIds.includes(request.operationId) ||
              canonical(grant.targets) !== canonical(request.targets) ||
              !audienceAllows(current, grant.audience)
            )
              throw new PluginRequestError("No matching execution grant", 403);
            const resolved = await this.hooks.resolve(grant.executorId, true);
            if (!resolved || !["viewer", "operator"].includes(resolved.role))
              throw new PluginRequestError(
                "Execution principal was revoked",
                403,
              );
            executor = resolved;
          }
          currentActor = current;
          currentExecutor = executor;
          return { actor: current, executor };
        };
        await revalidate();
        const invoke = async <T>(
          serviceId: string,
          kind: ExecutionTarget["kind"],
          id: string,
          value: unknown,
          work: () => Promise<T>,
        ) => {
          const target = request.targets.find(
            (item) =>
              item.serviceId === serviceId &&
              item.kind === kind &&
              item.id === id,
          );
          if (!target)
            throw new PluginRequestError(
              "Target is outside this execution scope",
              403,
            );
          if (
            target.inputSchema &&
            !this.checkSchema(target.inputSchema)(value)
          )
            throw new PluginRequestError(
              "Input is outside the approved execution constraints",
              422,
            );
          const identity = await revalidate();
          const resource =
            kind === "resource"
              ? await this.hooks.invoke(identity.executor, actorId, async () =>
                  (await this.hooks.services.listResources(serviceId))?.find(
                    (item) => item.id === id,
                  ),
                )
              : undefined;
          const permission =
            kind === "action" || resource?.policy === "sql"
              ? "execute"
              : "inspect";

          if (
            !(await this.hooks.authorize(identity.executor, permission, {
              type: "service",
              id: serviceId,
              ...(kind === "action"
                ? { actionId: id, actionInput: value }
                : {}),
            }))
          )
            throw new PluginRequestError(
              "Service execution permission was revoked",
              403,
            );
          const targetAudit = JSON.stringify({
            pluginId,
            subject: request.subject,
            revision: request.revision,
            operationId: request.operationId,
            serviceId,
            capabilityId: id,
            executorId: identity.executor.id,
          });
          this.hooks.audit(
            identity.actor.id,
            `execution.${kind}.dispatch`,
            targetAudit,
          );
          let result: T;
          try {
            result = await this.hooks.invoke(
              identity.executor,
              identity.actor.id,
              work,
              async () => {
                const current = await revalidate();
                if (
                  !(await this.hooks.authorize(current.executor, permission, {
                    type: "service",
                    id: serviceId,
                    ...(kind === "action"
                      ? { actionId: id, actionInput: value }
                      : {}),
                  }))
                )
                  throw new PluginRequestError(
                    "Execution authority was revoked before dispatch",
                    403,
                  );
              },
            );
          } catch (error) {
            this.hooks.audit(
              identity.actor.id,
              `execution.${kind}.failed`,
              targetAudit,
            );
            throw error;
          }
          this.hooks.audit(
            identity.actor.id,
            `execution.${kind}.completed`,
            targetAudit,
          );
          const after = await revalidate();
          if (
            !(await this.hooks.authorize(after.executor, permission, {
              type: "service",
              id: serviceId,
              ...(kind === "action"
                ? { actionId: id, actionInput: value }
                : {}),
            }))
          )
            throw new PluginRequestError(
              "Service permission was revoked during execution",
              403,
            );
          return result;
        };
        const allowedIds = new Set(
          request.targets.map((item) => item.serviceId),
        );
        const catalog = this.hooks.services;
        return {
          get actor() {
            return currentActor;
          },
          get executor() {
            return currentExecutor;
          },
          check: async () => {
            await revalidate();
          },
          services: {
            list: async () => {
              const identity = await revalidate();
              return {
                items: (
                  await Promise.all(
                    [...allowedIds].map((id) =>
                      this.hooks.invoke(identity.executor, actorId, () =>
                        catalog.get(id),
                      ),
                    ),
                  )
                ).filter((item) => item !== null),
              };
            },
            get: async (id) =>
              allowedIds.has(id)
                ? this.hooks.invoke(
                    (await revalidate()).executor,
                    actorId,
                    () => catalog.get(id),
                  )
                : null,
            listResources: async (id) =>
              allowedIds.has(id)
                ? this.hooks.invoke(
                    (await revalidate()).executor,
                    actorId,
                    async () =>
                      (await catalog.listResources(id))?.filter((item) =>
                        request.targets.some(
                          (target) =>
                            target.serviceId === id &&
                            target.kind === "resource" &&
                            target.id === item.id,
                        ),
                      ) ?? null,
                  )
                : null,
            listActions: async (id) =>
              allowedIds.has(id)
                ? this.hooks.invoke(
                    (await revalidate()).executor,
                    actorId,
                    async () =>
                      (await catalog.listActions(id))?.filter((item) =>
                        request.targets.some(
                          (target) =>
                            target.serviceId === id &&
                            target.kind === "action" &&
                            target.id === item.id,
                        ),
                      ) ?? null,
                  )
                : null,
            queryResource: (serviceId, id, value) =>
              invoke(serviceId, "resource", id, value, () =>
                catalog.queryResource(serviceId, id, value),
              ),
            executeAction: (serviceId, id, value, options) =>
              invoke(serviceId, "action", id, value, () =>
                catalog.executeAction(serviceId, id, value, {
                  ...options,
                  origin: {
                    pluginId,
                    ...(options?.origin?.runId
                      ? { runId: options.origin.runId }
                      : {}),
                  },
                }),
              ),
            probe: async () => {
              throw new PluginRequestError(
                "Probes are not application operations",
                403,
              );
            },
          },
          checkpoint: async () => {
            await revalidate();
            const { continuationId: _id, ...saved } = request;
            const authorityKey = createHash("sha256")
              .update(canonical({ actorId, local, request: saved }))
              .digest("hex");
            const expiresAt = Date.now() + 7 * 86400000;
            this.db
              .query("DELETE FROM continuations WHERE expires_at<=?")
              .run(Date.now());
            // These tokens describe authority, not individual job state. Reuse
            // identical authority so frequent runs do not duplicate manifests.
            const existing = this.db
              .query<{ id: string }, [string, string, number]>(
                "SELECT id FROM continuations WHERE plugin_id=? AND json_extract(data,'$.authorityKey')=? AND expires_at>? LIMIT 1",
              )
              .get(pluginId, authorityKey, Date.now() + 3600000);
            if (existing) return existing.id;
            const id = randomUUID();
            this.db.query("INSERT INTO continuations VALUES(?,?,?,?)").run(
              id,
              pluginId,
              JSON.stringify({
                actorId,
                local,
                request: saved,
                expiresAt,
                authorityKey,
              }),
              expiresAt,
            );
            return id;
          },
          close: () => {
            closed = true;
          },
        };
      },
    };
  }
  private checkSchema(schema: Record<string, unknown>): ValidateFunction {
    const key = canonical(schema);
    if (key.length > 32000)
      throw new PluginRequestError("Execution schema is too large", 422);
    const cached = this.checks.get(key);
    if (cached) return cached;
    const check = (value: unknown, depth = 0): void => {
      if (depth > 25)
        throw new PluginRequestError("Schema is too deeply nested", 422);
      if (!value || typeof value !== "object") return;
      for (const [name, item] of Object.entries(value)) {
        if (
          ["$async", "$data", "$ref", "pattern", "patternProperties"].includes(
            name,
          )
        )
          throw new PluginRequestError(
            "Unsupported execution schema keyword",
            422,
          );
        check(item, depth + 1);
      }
    };
    check(schema);
    const validate = this.validators.compile(schema);
    this.validators.removeSchema(schema);
    if (this.checks.size >= 128) this.checks.clear();
    this.checks.set(key, validate);
    return validate;
  }
  private async requireGrantManagement(pluginId: string) {
    const principal = this.hooks.principal();
    if (
      !this.hooks.authenticated() ||
      !principal ||
      !(await this.hooks.authorize(principal, "manage", {
        type: "plugin",
        id: pluginId,
      }))
    )
      throw new PluginRequestError(
        "Authenticated grant management permission required",
        403,
      );
    return principal;
  }
}
