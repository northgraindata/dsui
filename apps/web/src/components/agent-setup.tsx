import { Button, Input } from "@northgraindata/dsui-ui";
import { useEffect, useState } from "react";
import { type Connector, getConnectors } from "../api";
import "./agents.css";

type Environment = "docker" | "kubernetes" | "linux" | "windows" | "binary";

const environments: { id: Environment; label: string }[] = [
  { id: "docker", label: "Docker" },
  { id: "kubernetes", label: "Kubernetes" },
  { id: "linux", label: "Linux (systemd)" },
  { id: "windows", label: "Windows" },
  { id: "binary", label: "Any machine" },
];

/** The address agents dial: this DSUI instance as the browser reached it. */
export function instanceUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin)
    .toString()
    .replace(/\/$/, "");
}

export function commandsFor(
  environment: Environment,
  options: { url: string; token: string; name: string; targets: string[] },
): string {
  const targets = options.targets.length > 0 ? options.targets : ["HOST:PORT"];
  const list = targets.join(",");
  switch (environment) {
    case "docker":
      return [
        "docker run -d --name dsui-agent --restart unless-stopped \\",
        `  -e DSUI_URL=${options.url} \\`,
        `  -e DSUI_TOKEN=${options.token} \\`,
        `  -e DSUI_AGENT_NAME='${options.name}' \\`,
        `  -e DSUI_TARGETS='${list}' \\`,
        "  ghcr.io/northgraindata/dsui-agent:latest",
        "",
        "# Run it in the same Docker network as the services it should reach,",
        "# for example with --network <your-network>, and use service names as targets.",
      ].join("\n");
    case "kubernetes":
      return [
        "kubectl create namespace dsui",
        `kubectl -n dsui create secret generic dsui-agent-token --from-literal=token='${options.token}'`,
        "",
        "helm install dsui-agent oci://ghcr.io/northgraindata/charts/dsui-agent -n dsui \\",
        `  --set dsui.url=${options.url} \\`,
        `  --set name='${options.name}' \\`,
        "  --set token.existingSecret=dsui-agent-token \\",
        ...targets.map(
          (target, index) => `  --set 'targets[${index}]=${target}' \\`,
        ),
        "  --wait",
      ].join("\n");
    case "linux":
      return [
        "# 1. Install the .deb or .rpm from https://github.com/northgraindata/dsui-agent/releases",
        `echo '${options.token}' | sudo tee /etc/dsui-agent/token >/dev/null && sudo chmod 600 /etc/dsui-agent/token`,
        "",
        "# 2. Configure",
        "sudo tee /etc/dsui-agent/agent.yaml >/dev/null <<'EOF'",
        `url: ${options.url}`,
        `name: ${options.name}`,
        "targets:",
        ...targets.map((target) => `  - ${target}`),
        "EOF",
        "",
        "# 3. Start",
        "sudo systemctl enable --now dsui-agent",
      ].join("\n");
    case "windows":
      return [
        "# Download dsui-agent_<version>_windows_amd64.zip from",
        "# https://github.com/northgraindata/dsui-agent/releases and unzip it.",
        `Set-Content -Path token.txt -Value '${options.token}' -NoNewline`,
        `.\\dsui-agent.exe run --url ${options.url} --token-file token.txt --name '${options.name}' --targets '${list}'`,
        "",
        "# To keep it running as a service, see examples/windows.md in the repository.",
      ].join("\n");
    case "binary":
      return [
        "# Download the archive for your OS from",
        "# https://github.com/northgraindata/dsui-agent/releases",
        `echo '${options.token}' > token && chmod 600 token`,
        `./dsui-agent run --url ${options.url} --token-file token --name '${options.name}' --targets '${list}'`,
      ].join("\n");
  }
}

function describe(connector: Connector): string {
  const { info } = connector;
  const parts = [
    info.observedIp && `IP ${info.observedIp}`,
    info.hostname,
    info.os && info.arch && `${info.os}/${info.arch}`,
    info.version && `v${info.version}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Shows the token once, the commands to run the agent, and its live status. */
export function AgentSetup({
  connector: initial,
  token,
  onOnline,
}: {
  connector: Connector;
  token: string;
  onOnline?(connector: Connector): void;
}) {
  const [environment, setEnvironment] = useState<Environment>("docker");
  const [targetsText, setTargetsText] = useState("");
  const [connector, setConnector] = useState(initial);
  const [copied, setCopied] = useState(false);
  const targets = targetsText
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const commands = commandsFor(environment, {
    url: instanceUrl(),
    token,
    name: connector.name,
    targets,
  });

  useEffect(() => {
    let active = true;
    let notified = false;
    const poll = async () => {
      try {
        const all = await getConnectors();
        const current = all.find((entry) => entry.id === initial.id);
        if (!active || !current) return;
        setConnector(current);
        if (current.online && !notified) {
          notified = true;
          onOnline?.(current);
        }
      } catch {
        // A failed poll only delays the status; the next one retries.
      }
    };
    const timer = setInterval(poll, 2500);
    void poll();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [initial.id, onOnline]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(commands);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="agent-setup">
      <p className="agent-setup-note">
        Run the agent next to the services DSUI should reach. It only makes
        outbound connections, and it can only open the targets you list below.
        <strong> The token is shown once.</strong>
      </p>
      <div className="agent-field">
        <label htmlFor="agent-targets">Targets the agent may reach</label>
        <Input
          id="agent-targets"
          value={targetsText}
          placeholder="airflow-api:8080, clickhouse:8123"
          onChange={(event) => setTargetsText(event.target.value)}
        />
        <small>
          Hosts and ports as the agent sees them from its own network.
        </small>
      </div>
      <fieldset className="agent-tabs">
        <legend className="sr-only">Where will you run it?</legend>
        {environments.map((entry) => (
          <button
            type="button"
            key={entry.id}
            aria-pressed={environment === entry.id}
            onClick={() => setEnvironment(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </fieldset>
      <div className="agent-code">
        <pre>
          <code>{commands}</code>
        </pre>
        <Button type="button" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <output
        className="agent-status"
        data-online={connector.online}
        aria-live="polite"
      >
        <span aria-hidden="true" className="agent-dot" />
        {connector.online ? (
          <>
            <strong>Agent online</strong>
            <span>{describe(connector)}</span>
          </>
        ) : (
          <span>Waiting for the agent to connect…</span>
        )}
      </output>
    </div>
  );
}
