import { randomUUID } from "node:crypto";
import type { Context, Hono } from "hono";
import { z } from "zod";
import { allowed } from "../auth.js";
import type { ConnectorStatus, TunnelManager } from "../connectors/manager.js";
import { TunnelError } from "../connectors/protocol.js";
import { CONNECTOR_KEY } from "../connectors/routing.js";
import { issueToken } from "../connectors/tokens.js";
import type { ConnectionCipher } from "../db/crypto.js";
import type { ConnectorRow, DsuiDatabase } from "../db/database.js";
import type { PluginRuntime } from "../plugins/runtime.js";
import { errorMessage, httpStatus } from "./errors.js";

const nameSchema = z.string().trim().min(1).max(80);
const createSchema = z.object({ name: nameSchema });
const targetSchema = z.object({
  target: z
    .string()
    .trim()
    .regex(/^[^\s:/]+:\d{1,5}$|^\[[0-9a-fA-F:]+\]:\d{1,5}$/, "Use host:port"),
});

export interface ConnectorRouteDeps {
  database: DsuiDatabase;
  cipher: ConnectionCipher | undefined;
  tunnel: TunnelManager;
  pluginRuntime?: PluginRuntime;
  audit(
    actor: string,
    action: string,
    target: string,
    metadata?: Record<string, unknown>,
  ): void;
}

export interface PublicConnector {
  id: string;
  name: string;
  createdAt: string;
  revokedAt: string | null;
  lastConnectedAt: string | null;
  lastSeenAt: string | null;
  online: boolean;
  activeStreams: number;
  info: ConnectorStatus["info"];
  /** Services that route through this agent. */
  services: { id: string; name: string }[];
}

/** Services whose stored connection names this connector. */
function servicesUsing(
  deps: Pick<ConnectorRouteDeps, "database" | "cipher">,
  connectorId: string,
): { id: string; name: string }[] {
  if (!deps.cipher) return [];
  const used: { id: string; name: string }[] = [];
  for (const row of deps.database.listUiServices()) {
    try {
      const connection = deps.cipher.decrypt<Record<string, unknown>>({
        ciphertext: row.connection_ciphertext,
        iv: row.connection_iv,
        tag: row.connection_tag,
      });
      if (connection?.[CONNECTOR_KEY] === connectorId)
        used.push({ id: row.id, name: row.name });
    } catch {
      // An unreadable row cannot be attributed; it is not this connector's concern.
    }
  }
  return used;
}

function toPublic(
  deps: ConnectorRouteDeps,
  row: ConnectorRow,
): PublicConnector {
  const status = deps.tunnel.status(row);
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    lastConnectedAt: row.last_connected_at,
    lastSeenAt: row.last_seen_at,
    online: status.online,
    activeStreams: status.activeStreams,
    info: status.info,
    services: servicesUsing(deps, row.id),
  };
}

export function registerConnectorRoutes(
  app: Hono,
  deps: ConnectorRouteDeps,
): void {
  const guard = async (
    context: Context,
    permission: "inspect" | "manage",
  ): Promise<boolean> => {
    const principal = context.get("principal");
    if (!allowed(principal, permission)) return false;
    return deps.pluginRuntime
      ? await deps.pluginRuntime.authorize(principal, permission)
      : true;
  };
  const denied = (context: Context) =>
    context.json({ message: "Insufficient permission" }, 403);
  const find = (id: string): ConnectorRow => {
    const row = deps.database.getConnector(id);
    if (!row) throw new Error("Connector not found");
    return row;
  };

  app.get("/api/v1/connectors", async (context) => {
    if (!(await guard(context, "inspect"))) return denied(context);
    return context.json(
      deps.database.listConnectors().map((row) => toPublic(deps, row)),
    );
  });

  app.post("/api/v1/connectors", async (context) => {
    if (!(await guard(context, "manage"))) return denied(context);
    try {
      const input = createSchema.parse(await context.req.json());
      const id = randomUUID();
      const issued = issueToken(id);
      deps.database.insertConnector({
        id,
        name: input.name,
        token_hash: issued.tokenHash,
        created_by: context.get("principal").id,
      });
      deps.audit(context.get("principal").id, "connector.create", id);
      // The token is returned exactly once and never stored in plain text.
      return context.json(
        { connector: toPublic(deps, find(id)), token: issued.token },
        201,
      );
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.patch("/api/v1/connectors/:id", async (context) => {
    if (!(await guard(context, "manage"))) return denied(context);
    try {
      const row = find(context.req.param("id"));
      const input = createSchema.parse(await context.req.json());
      deps.database.renameConnector(row.id, input.name);
      deps.audit(context.get("principal").id, "connector.rename", row.id);
      return context.json(toPublic(deps, find(row.id)));
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.post("/api/v1/connectors/:id/rotate", async (context) => {
    if (!(await guard(context, "manage"))) return denied(context);
    try {
      const row = find(context.req.param("id"));
      const issued = issueToken(row.id);
      deps.database.rotateConnectorToken(row.id, issued.tokenHash);
      deps.tunnel.disconnect(row.id, "token rotated");
      deps.audit(context.get("principal").id, "connector.rotate", row.id);
      return context.json({
        connector: toPublic(deps, find(row.id)),
        token: issued.token,
      });
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.post("/api/v1/connectors/:id/revoke", async (context) => {
    if (!(await guard(context, "manage"))) return denied(context);
    try {
      const row = find(context.req.param("id"));
      deps.database.revokeConnector(row.id);
      deps.tunnel.disconnect(row.id, "revoked");
      deps.audit(context.get("principal").id, "connector.revoke", row.id);
      return context.json(toPublic(deps, find(row.id)));
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  app.delete("/api/v1/connectors/:id", async (context) => {
    if (!(await guard(context, "manage"))) return denied(context);
    try {
      const row = find(context.req.param("id"));
      const users = servicesUsing(deps, row.id);
      if (users.length > 0)
        return context.json(
          {
            message: `Still used by: ${users.map((s) => s.name).join(", ")}. Switch those services to a direct connection first.`,
          },
          409,
        );
      deps.tunnel.disconnect(row.id, "deleted");
      deps.database.deleteConnector(row.id);
      deps.audit(context.get("principal").id, "connector.delete", row.id);
      return context.body(null, 204);
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });

  /** Checks that the agent can open `host:port`; used by onboarding and the service form. */
  app.post("/api/v1/connectors/:id/test-target", async (context) => {
    if (!(await guard(context, "manage"))) return denied(context);
    try {
      const row = find(context.req.param("id"));
      const input = targetSchema.parse(await context.req.json());
      const started = Date.now();
      try {
        const stream = await deps.tunnel.openStream(row.id, input.target);
        stream.reset();
        return context.json({ ok: true, ms: Date.now() - started });
      } catch (error) {
        if (!(error instanceof TunnelError)) throw error;
        return context.json({
          ok: false,
          code: error.code,
          message: error.message,
          ms: Date.now() - started,
        });
      }
    } catch (error) {
      return context.json({ message: errorMessage(error) }, httpStatus(error));
    }
  });
}
