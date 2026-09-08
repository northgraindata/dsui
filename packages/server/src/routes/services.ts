import { randomUUID } from "node:crypto";
import type { HealthStatus, PublicService } from "@northgraindata/dsui-core";
import type { Hono } from "hono";
import { z } from "zod";
import type { AdapterRegistry } from "../adapters/registry.js";
import { allowed } from "../auth.js";
import type { ConfiguredService, DsuiConfig } from "../config.js";
import type { ConnectionCipher } from "../db/crypto.js";
import type { DsuiDatabase, UiServiceRow } from "../db/database.js";
import { errorMessage, httpStatus } from "./errors.js";

export const createServiceSchema = z.object({
  adapter: z.string().min(1),
  name: z.string().min(1).max(120),
  connection: z.record(z.unknown()).default({}),
});

export type ServiceSource =
  | { service: ConfiguredService; managedBy: "configuration" }
  | { service: UiServiceRow; managedBy: "ui" };

export function serviceSource(
  config: DsuiConfig,
  database: DsuiDatabase,
  id: string,
): ServiceSource | null {
  const configured = config.services.find((service) => service.id === id);
  if (configured) return { service: configured, managedBy: "configuration" };
  const stored = database.getUiService(id);
  return stored ? { service: stored, managedBy: "ui" } : null;
}

/** Resolves and decrypts a service connection. Never logs or returns secrets. */
export function connectionFor(
  cipher: ConnectionCipher | undefined,
  source: ServiceSource,
): Record<string, unknown> {
  if (source.managedBy === "configuration")
    return { ...(source.service as ConfiguredService).connection };
  const row = source.service as UiServiceRow;
  const decrypted = cipher?.decrypt<Record<string, unknown>>({
    ciphertext: row.connection_ciphertext,
    iv: row.connection_iv,
    tag: row.connection_tag,
  });
  if (!decrypted)
    throw new Error("DSUI_MASTER_KEY is required to read UI-managed services");
  return decrypted;
}

export interface ServiceDeps {
  registry: AdapterRegistry;
  database: DsuiDatabase;
  cipher: ConnectionCipher | undefined;
  getConfig(): DsuiConfig;
  refreshConfig(): Promise<DsuiConfig>;
}

export async function publicService(
  deps: ServiceDeps,
  id: string,
): Promise<PublicService> {
  const source = serviceSource(deps.getConfig(), deps.database, id);
  if (!source) throw new Error("Service not found");
  const adapter = deps.registry.get(source.service.adapter);
  const connection = connectionFor(deps.cipher, source);
  const health = await adapter.backend.checkHealth(connection);
  return {
    id: source.service.id,
    name: source.service.name ?? adapter.metadata.name,
    adapter: adapter.id,
    health: health.status,
    ...(health.detail ? { detail: health.detail } : {}),
    ...(health.latencyMs !== undefined ? { latencyMs: health.latencyMs } : {}),
    managedBy: source.managedBy,
    resources: adapter.catalog.resources.map((resource) => resource.id),
    actions: adapter.catalog.actions.map((action) => action.id),
    ...(adapter.metadata.iconUrl ? { logo: adapter.metadata.iconUrl } : {}),
  };
}

export async function testConnection(
  deps: ServiceDeps,
  adapterId: string,
  raw: Record<string, unknown>,
): Promise<HealthStatus> {
  const adapter = deps.registry.get(adapterId);
  const connection = adapter.backend.validateConnection(raw);
  return adapter.backend.checkHealth(connection);
}

export function registerServiceRoutes(
  app: Hono,
  deps: ServiceDeps & {
    audit(
      actor: string,
      action: string,
      target: string,
      metadata?: Record<string, unknown>,
    ): void;
  },
): void {
  app.get("/api/v1/services", async (context) => {
    try {
      const config = await deps.refreshConfig();
      const ids = [
        ...config.services.map((service) => service.id),
        ...deps.database
          .listUiServices()
          .filter(
            (row) => !config.services.some((service) => service.id === row.id),
          )
          .map((row) => row.id),
      ];
      return context.json(
        await Promise.all(ids.map((id) => publicService(deps, id))),
      );
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.post("/api/v1/services/test", async (context) => {
    try {
      await deps.refreshConfig();
      const input = createServiceSchema.parse(await context.req.json());
      return context.json(
        await testConnection(deps, input.adapter, input.connection),
      );
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.post("/api/v1/services", async (context) => {
    const principal = context.get("principal");
    if (!allowed(principal, "manage"))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      await deps.refreshConfig();
      const input = createServiceSchema.parse(await context.req.json());
      const adapter = deps.registry.get(input.adapter);
      const connection = adapter.backend.validateConnection(input.connection);
      if (!deps.cipher)
        throw new Error(
          "DSUI_MASTER_KEY is required to persist UI-managed connections",
        );
      const id = randomUUID();
      deps.database.insertUiService(
        { id, name: input.name, adapter: input.adapter },
        deps.cipher.encrypt(connection),
      );
      deps.audit(principal.id, "service.create", id, {
        adapter: input.adapter,
      });
      return context.json(await publicService(deps, id), 201);
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.delete("/api/v1/services/:id", async (context) => {
    const principal = context.get("principal");
    if (!allowed(principal, "manage"))
      return context.json({ message: "Insufficient permission" }, 403);
    try {
      const config = await deps.refreshConfig();
      const source = serviceSource(
        config,
        deps.database,
        context.req.param("id"),
      );
      if (!source) throw new Error("Service not found");
      if (source.managedBy !== "ui")
        throw new Error(
          "Configuration-managed services cannot be deleted here",
        );
      deps.database.deleteUiService(source.service.id);
      deps.audit(principal.id, "service.delete", source.service.id, {
        adapter: source.service.adapter,
      });
      return context.body(null, 204);
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.get("/api/v1/services/:id/pages", async (context) => {
    try {
      await deps.refreshConfig();
      const source = serviceSource(
        deps.getConfig(),
        deps.database,
        context.req.param("id"),
      );
      if (!source) throw new Error("Service not found");
      const adapter = deps.registry.get(source.service.adapter);
      return context.json({ pages: adapter.catalog.pages });
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.get("/api/v1/services/:id/page", async (context) => {
    try {
      await deps.refreshConfig();
      const path = context.req.query("path");
      if (!path?.startsWith("/"))
        return context.json({ message: "A page path is required" }, 400);
      const source = serviceSource(
        deps.getConfig(),
        deps.database,
        context.req.param("id"),
      );
      if (!source) throw new Error("Service not found");
      const adapter = deps.registry.get(source.service.adapter);
      return context.json(
        await adapter.backend.renderPage(
          connectionFor(deps.cipher, source),
          path,
        ),
      );
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });
}
