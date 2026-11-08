import type { DsuiDatabase } from "../db/database";
import type { ConnectorProxy } from "./proxy";

/**
 * Reserved connection key. The UI sets it when a service uses "Via DSUI Agent".
 * It names a connector id and is removed before the connection reaches an adapter.
 */
export const CONNECTOR_KEY = "__connector";

export interface RoutedConnection {
  connection: unknown;
  /** Extra environment for the adapter host process, set only for routed services. */
  env?: Record<string, string>;
}

export interface ConnectorRouting {
  route(connection: unknown): RoutedConnection;
}

let active: ConnectorRouting | undefined;

export function setConnectorRouting(
  routing: ConnectorRouting | undefined,
): void {
  active = routing;
}

export function connectorIdOf(connection: unknown): string | undefined {
  if (!connection || typeof connection !== "object") return undefined;
  const value = (connection as Record<string, unknown>)[CONNECTOR_KEY];
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function withoutConnector(connection: unknown): unknown {
  if (connectorIdOf(connection) === undefined) return connection;
  const { [CONNECTOR_KEY]: _removed, ...rest } = connection as Record<
    string,
    unknown
  >;
  return rest;
}

/** Used by the adapter backend for every host call. */
export function routeConnection(connection: unknown): RoutedConnection {
  if (connectorIdOf(connection) === undefined) return { connection };
  if (!active)
    throw new Error(
      "This service uses a DSUI agent, but connector support is not running",
    );
  return active.route(connection);
}

export function createConnectorRouting(
  database: DsuiDatabase,
  proxy: ConnectorProxy,
): ConnectorRouting {
  return {
    route(connection) {
      const id = connectorIdOf(connection) as string;
      const connector = database.getConnector(id);
      if (!connector)
        throw new Error("The DSUI agent used by this service no longer exists");
      if (connector.revoked_at)
        throw new Error(`The DSUI agent "${connector.name}" has been revoked`);
      const url = proxy.urlFor(id);
      return {
        connection: withoutConnector(connection),
        env: {
          HTTP_PROXY: url,
          HTTPS_PROXY: url,
          http_proxy: url,
          https_proxy: url,
          // Everything goes through the agent, including loopback-looking names
          // that only exist inside the customer's network.
          NO_PROXY: "",
          no_proxy: "",
          // For clients that need an explicit setting rather than the standard variables.
          DSUI_CONNECTOR_PROXY_URL: url,
        },
      };
    },
  };
}
