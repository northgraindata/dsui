import { Button, Input, OptionSelect } from "@northgraindata/dsui-ui";
import { useCallback, useEffect, useState } from "react";
import {
  type Connector,
  type ConnectorWithToken,
  createConnector,
  getConnectors,
} from "../api";
import { AgentSetup } from "./agent-setup";
import { Icon } from "./icon";
import "./agents.css";

export type Route = "direct" | "agent";

/**
 * Lets a service choose between a direct connection and "Via DSUI Agent".
 * It works for every adapter because the choice is independent of the
 * adapter's own connection fields.
 */
export function ConnectorRoute({
  route,
  connectorId,
  onRoute,
  onConnector,
}: {
  route: Route;
  connectorId: string | undefined;
  onRoute(route: Route): void;
  onConnector(id: string | undefined): void;
}) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loadError, setLoadError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<ConnectorWithToken>();

  const reload = useCallback(async () => {
    try {
      setConnectors(await getConnectors());
      setLoadError(undefined);
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? cause.message : "Could not load agents",
      );
    }
  }, []);
  useEffect(() => {
    if (route === "agent") void reload();
  }, [route, reload]);

  const usable = connectors.filter((connector) => !connector.revokedAt);
  const selected = usable.find((connector) => connector.id === connectorId);

  async function create() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await createConnector(name.trim());
      setCreated(result);
      setCreating(false);
      setName("");
      onConnector(result.connector.id);
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create the agent",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="connection-methods agent-route">
      <legend>How should DSUI reach it?</legend>
      <p>
        Straight from this instance, or through an agent inside your network.
      </p>
      <div className="connection-method-grid">
        <label className="connection-method" data-selected={route === "direct"}>
          <input
            type="radio"
            name="connection-route"
            checked={route === "direct"}
            onChange={() => onRoute("direct")}
          />
          <Icon name="plug" size={21} />
          <span>
            <strong>Direct</strong>
            <small>The source is reachable from this DSUI instance.</small>
          </span>
        </label>
        <label className="connection-method" data-selected={route === "agent"}>
          <input
            type="radio"
            name="connection-route"
            checked={route === "agent"}
            onChange={() => onRoute("agent")}
          />
          <Icon name="cpu" size={21} />
          <span>
            <strong>Via DSUI Agent</strong>
            <small>Private network. No inbound ports to open.</small>
          </span>
        </label>
      </div>
      {route === "agent" && (
        <div className="agent-route-body">
          <small>
            Enter the host and port exactly as the agent sees them from its
            network.
          </small>
          {loadError && (
            <p className="agent-error" role="alert">
              {loadError}
            </p>
          )}
          {usable.length > 0 && !created && (
            <OptionSelect
              id="connection-agent"
              value={connectorId}
              placeholder="Choose an agent"
              options={usable.map((connector) => ({
                value: connector.id,
                label: connector.name,
                description: connector.online
                  ? `Online${connector.info.observedIp ? ` · ${connector.info.observedIp}` : ""}`
                  : "Offline",
              }))}
              onValueChange={onConnector}
            />
          )}
          {selected && !selected.online && !created && (
            <p className="agent-error" role="status">
              This agent is offline. Start it, or the test will fail.
            </p>
          )}
          {created && (
            <>
              <AgentSetup
                connector={created.connector}
                token={created.token}
                onOnline={() => void reload()}
              />
              <Button type="button" onClick={() => setCreated(undefined)}>
                I saved the token
              </Button>
            </>
          )}
          {!created && !creating && (
            <Button
              className="agent-add"
              type="button"
              variant="secondary"
              onClick={() => setCreating(true)}
            >
              {usable.length > 0 ? "Add another agent" : "Add an agent"}
            </Button>
          )}
          {creating && (
            <div className="agent-field">
              <label htmlFor="agent-name">Agent name</label>
              <Input
                id="agent-name"
                value={name}
                placeholder="Production network"
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void create();
                  }
                }}
              />
              <small>
                One agent serves a whole site. Many services can share it.
              </small>
              {error && (
                <p className="agent-error" role="alert">
                  {error}
                </p>
              )}
              <div className="agent-row-actions">
                <Button
                  type="button"
                  onClick={create}
                  disabled={busy || !name.trim()}
                >
                  Create agent
                </Button>
                <Button type="button" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}
