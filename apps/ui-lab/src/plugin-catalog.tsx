import { available, ProPluginView } from "virtual:dsui-pro-suite";
import {
  serializeNodes,
  type PageNode,
} from "@northgraindata/dsui-adapter-sdk";
import {
  DeclarativePageRenderer,
  type RendererClient,
} from "@northgraindata/dsui-renderer";
import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  AgentDrawer,
  AgentLauncher,
} from "../../../packages/plugin-ai-agent/src/chat/chat";
import { initializeReact as agentReact } from "../../../packages/plugin-ai-agent/src/chat/react";
import type { Client as RepositoryClient } from "../../../packages/plugin-code-repository/src/components/shared";
import { RepositoryScreen } from "../../../packages/plugin-code-repository/src/components/screen";
import { initializeReact as repositoryReact } from "../../../packages/plugin-code-repository/src/components/react";
import type { CatalogEntry } from "./catalog-types";
import { pluginClient } from "./plugin-fixtures";
agentReact(React, ReactDOM);
repositoryReact(React);
function renderNode(client: RendererClient, node: PageNode) {
  return (
    <DeclarativePageRenderer client={client} nodes={serializeNodes([node])} />
  );
}
function renderRepositoryNode(client: RepositoryClient, node: PageNode) {
  return renderNode(
    {
      ...client,
      navigate(path) {
        client.navigate?.(path);
      },
      async executeAction(ref) {
        const result = await client.executeAction(ref);
        return result.status === "success"
          ? { status: "success", data: result.data }
          : { status: "error", message: result.message };
      },
    },
    node,
  );
}
function PluginPreview({
  plugin,
  view,
  state,
}: {
  plugin: string;
  view: string;
  state: string;
}) {
  const [event, setEvent] = React.useState("");
  const client = React.useMemo(
    () => pluginClient(plugin, state, setEvent),
    [plugin, state],
  );
  const node = {
    kind: "custom",
    props: {
      props: {
        ...(view === "settings"
          ? { serviceId: "dbt" }
          : view === "explorer"
            ? {
                serviceId: "dbt",
                connectionId: "00000000-0000-4000-8000-000000000001",
                path: "models/orders.sql",
              }
            : {}),
      },
    },
  };
  let content;
  if (plugin === "agent")
    content =
      view === "launcher" ? (
        <AgentLauncher client={client} node={node} renderNode={renderNode} />
      ) : (
        <AgentDrawer client={client} node={node} renderNode={renderNode} />
      );
  else if (plugin === "repository")
    content = (
      <RepositoryScreen
        client={client}
        node={node}
        renderNode={renderRepositoryNode}
      />
    );
  else if (
    plugin === "auth" &&
    view === "sign-in" &&
    typeof window === "undefined"
  )
    content = (
      <p>
        Auth sign-in uses browser location. Open this example in the browser.
      </p>
    );
  else if (available)
    content = (
      <ProPluginView
        plugin={plugin}
        view={view}
        client={client}
        renderNode={renderNode}
      />
    );
  else
    content = (
      <p className="lab-notice">
        Connect DSUI_PRO_DIR to render this private plugin.
      </p>
    );
  return (
    <div
      className={`lab-plugin-preview lab-plugin-${plugin}`}
      onSubmitCapture={
        plugin === "auth" && view === "sign-in"
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              setEvent("Local preview: sign-in was not sent.");
            }
          : undefined
      }
    >
      {content}
      <output className="lab-events" aria-live="polite">
        {event}
      </output>
    </div>
  );
}
const resources = ["normal", "empty", "loading", "error"];
function entry(
  plugin: string,
  view: string,
  title: string,
  states: string[],
  source: string,
): CatalogEntry {
  return {
    id: `plugins/${plugin}/${view}`,
    title,
    group: ["agent", "repository"].includes(plugin) ? "Plugins" : "DSUI Pro",
    description:
      "Production plugin component with local deterministic fixtures. No production actions or AI requests.",
    source,
    examples: states.map((state) => ({
      id: state,
      title: state,
      render: () => <PluginPreview plugin={plugin} view={view} state={state} />,
    })),
  };
}
export const pluginCatalog: CatalogEntry[] = [
  entry(
    "agent",
    "drawer",
    "AI Agent · conversation",
    [...resources, "unconfigured", "running", "failed", "stress"],
    "packages/plugin-ai-agent/src/chat/chat.tsx",
  ),
  entry(
    "agent",
    "launcher",
    "AI Agent · launcher",
    ["normal"],
    "packages/plugin-ai-agent/src/chat/chat.tsx",
  ),
  ...["overview", "settings", "explorer"].map((view) =>
    entry(
      "repository",
      view,
      `Code repository · ${view}`,
      [...resources, "syncing", "failed"],
      "packages/plugin-code-repository/src/components/screen.tsx",
    ),
  ),
  ...["overview", "channels", "rules"].map((view) =>
    entry(
      "notifications",
      view,
      `Notifications · ${view}`,
      [...resources, "paused", "failed"],
      "dsui-pro/packages/plugin-notifications-pro/src/components/screen.tsx",
    ),
  ),
  ...["tokens", "activity", "authorize"].map((view) =>
    entry(
      "mcp",
      view,
      `MCP · ${view}`,
      [
        ...resources,
        ...(view === "authorize" ? ["expired"] : ["offline", "readonly"]),
      ],
      "dsui-pro/packages/plugin-mcp-pro/src/components/screen.tsx",
    ),
  ),
  entry(
    "auth",
    "admin",
    "Auth · members and teams",
    resources,
    "dsui-pro/packages/plugin-auth-pro/src/components/access-admin.mjs",
  ),
  entry(
    "auth",
    "sign-in",
    "Auth · sign in / registration",
    ["normal"],
    "dsui-pro/packages/plugin-auth-pro/src/browser.mjs",
  ),
  entry(
    "auth",
    "sidebar-profile",
    "Auth · profile",
    ["normal"],
    "dsui-pro/packages/plugin-auth-pro/src/browser.mjs",
  ),
];
