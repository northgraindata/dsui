import { Button, Input } from "@northgraindata/dsui-ui";
import { useCallback, useEffect, useState } from "react";
import {
  type Connector,
  type ConnectorWithToken,
  createConnector,
  deleteConnector,
  getConnectors,
  revokeConnector,
  rotateConnector,
  testConnectorTarget,
} from "../../api";
import { AgentSetup } from "../../components/agent-setup";
import "../../components/agents.css";
import { SettingsPanel } from "./settings-fields";

function lastSeen(connector: Connector): string {
  if (connector.online) return "Online now";
  if (!connector.lastSeenAt) return "Never connected";
  return `Last seen ${new Date(connector.lastSeenAt).toLocaleString()}`;
}

function details(connector: Connector): string {
  const { info } = connector;
  return [
    info.observedIp && `IP ${info.observedIp}`,
    info.hostname,
    info.os && info.arch && `${info.os}/${info.arch}`,
    info.version && `v${info.version}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function AgentRow({
  connector,
  onChange,
  onToken,
}: {
  connector: Connector;
  onChange(): void;
  onToken(value: ConnectorWithToken): void;
}) {
  const [target, setTarget] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>();
  const [error, setError] = useState<string>();

  async function act(run: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(undefined);
    try {
      await run();
      onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed");
    }
  }

  async function test() {
    if (!target.trim() || testing) return;
    setTesting(true);
    setTestResult(undefined);
    try {
      const result = await testConnectorTarget(connector.id, target.trim());
      setTestResult(
        result.ok
          ? `Reachable from the agent (${result.ms} ms)`
          : `Not reachable: ${result.message}`,
      );
    } catch (cause) {
      setTestResult(cause instanceof Error ? cause.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <li className="agent-row">
      <header>
        <strong>{connector.name}</strong>
        <span
          className="agent-status"
          data-online={connector.online && !connector.revokedAt}
        >
          <span aria-hidden="true" className="agent-dot" />
          {connector.revokedAt ? "Revoked" : lastSeen(connector)}
        </span>
      </header>
      {details(connector) && (
        <span className="agent-row-meta">{details(connector)}</span>
      )}
      {connector.info.targets && connector.info.targets.length > 0 && (
        <span className="agent-row-meta">
          Allows: {connector.info.targets.join(", ")}
        </span>
      )}
      <span className="agent-row-meta">
        {connector.services.length > 0
          ? `Used by ${connector.services.map((service) => service.name).join(", ")}`
          : "Not used by any service yet"}
      </span>
      {connector.online && (
        <div className="agent-field">
          <label htmlFor={`target-${connector.id}`}>Test a target</label>
          <div className="agent-row-actions">
            <Input
              id={`target-${connector.id}`}
              value={target}
              placeholder="airflow-api:8080"
              onChange={(event) => setTarget(event.target.value)}
            />
            <Button
              type="button"
              onClick={test}
              disabled={testing || !target.trim()}
            >
              {testing ? "Testing…" : "Test"}
            </Button>
          </div>
          {testResult && <small role="status">{testResult}</small>}
        </div>
      )}
      <div className="agent-row-actions">
        <Button
          type="button"
          onClick={() =>
            act(
              async () => onToken(await rotateConnector(connector.id)),
              "Rotate the token? The running agent is disconnected until you restart it with the new token.",
            )
          }
        >
          Rotate token
        </Button>
        {!connector.revokedAt && (
          <Button
            type="button"
            onClick={() =>
              act(
                () => revokeConnector(connector.id),
                "Revoke this agent? It is disconnected now and cannot reconnect.",
              )
            }
          >
            Revoke
          </Button>
        )}
        <Button
          type="button"
          onClick={() =>
            act(
              () => deleteConnector(connector.id),
              "Delete this agent? This cannot be undone.",
            )
          }
        >
          Delete
        </Button>
      </div>
      {error && (
        <p className="agent-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

export function AgentSettings() {
  const [connectors, setConnectors] = useState<Connector[]>();
  const [loadError, setLoadError] = useState<string>();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [issued, setIssued] = useState<ConnectorWithToken>();

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
    void reload();
    const timer = setInterval(() => void reload(), 5000);
    return () => clearInterval(timer);
  }, [reload]);

  async function create() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setCreateError(undefined);
    try {
      setIssued(await createConnector(name.trim()));
      setName("");
      await reload();
    } catch (cause) {
      setCreateError(
        cause instanceof Error ? cause.message : "Could not create the agent",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsPanel
      title="DSUI Agents"
      description="Agents run inside your network and carry traffic to sources DSUI cannot reach directly. They only make outbound connections."
    >
      {loadError && (
        <p className="agent-error" role="alert">
          {loadError}
        </p>
      )}
      {issued && (
        <div className="agent-row">
          <strong>{issued.connector.name}</strong>
          <AgentSetup connector={issued.connector} token={issued.token} />
          <div className="agent-row-actions">
            <Button type="button" onClick={() => setIssued(undefined)}>
              I saved the token
            </Button>
          </div>
        </div>
      )}
      <ul className="agent-list">
        {connectors?.map((connector) => (
          <AgentRow
            key={connector.id}
            connector={connector}
            onChange={() => void reload()}
            onToken={setIssued}
          />
        ))}
        {connectors?.length === 0 && (
          <li className="agent-row-meta">No agents yet.</li>
        )}
      </ul>
      <div className="agent-field">
        <label htmlFor="new-agent-name">New agent</label>
        <div className="agent-row-actions">
          <Input
            id="new-agent-name"
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
          <Button
            type="button"
            onClick={create}
            disabled={busy || !name.trim()}
          >
            Create agent
          </Button>
        </div>
        {createError && (
          <p className="agent-error" role="alert">
            {createError}
          </p>
        )}
      </div>
    </SettingsPanel>
  );
}
