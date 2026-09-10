import type { PageNode } from "@northgraindata/dsui-core";
import { Button, Input } from "@northgraindata/dsui-ui";
import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { ActionIcon } from "./ActionIcon";
import { DependencyGraphView } from "./DependencyGraphView";
import { QueryWorkbench } from "./QueryWorkbench";
import { ResourceTreeView } from "./ResourceTree";
import {
  ResourceKeyValue,
  ResourceTable,
  resolveActionSuccessLink,
} from "./ResourceViews";
import { SplitPaneView } from "./SplitPane";
import { Tabs } from "./Tabs";
import type { RendererClient } from "./types";

function PageActionButton({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "button" }>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={
          node.props.variant === "primary" ? "default" : node.props.variant
        }
        disabled={busy}
        aria-busy={busy}
        title={error}
        onClick={() => {
          if (!node.props.action) return;
          setBusy(true);
          setError(undefined);
          client
            .executeAction(node.props.action)
            .then((result) => {
              if (result.status === "error")
                setError(result.message ?? "Action failed");
              else if (node.props.successLink) {
                const destination = resolveActionSuccessLink(
                  node.props.successLink,
                  result.data,
                );
                if (destination) client.navigate(destination);
                else setError("Action returned no navigation target");
              }
            })
            .catch((cause) =>
              setError(
                cause instanceof Error ? cause.message : "Action failed",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        {node.props.icon ? <ActionIcon name={node.props.icon} /> : null}
        {busy ? `${node.props.label}…` : node.props.label}
      </Button>
      {error ? (
        <span role="alert" className="text-[11px] text-unavailable">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function PageNodeRenderer({
  client,
  node,
}: {
  client: RendererClient;
  node: PageNode;
}) {
  switch (node.kind) {
    case "page-header":
      return (
        <header>
          <h1 className="m-0 text-[17px] font-semibold text-primary">
            {node.props.title}
          </h1>
          {node.props.description ? (
            <p className="mt-1 text-[12px] text-secondary">
              {node.props.description}
            </p>
          ) : null}
        </header>
      );
    case "table":
      return <ResourceTable client={client} node={node} />;
    case "dependency-graph":
      return <DependencyGraphView client={client} node={node} />;
    case "key-value":
      return <ResourceKeyValue client={client} node={node} />;
    case "query-workbench":
      return <QueryWorkbench client={client} node={node} />;
    case "resource-tree":
      return <ResourceTreeView client={client} node={node} />;
    case "split-pane":
      return (
        <SplitPaneView
          client={client}
          node={node}
          renderNode={(nextClient, child) => (
            <PageNodeRenderer
              key={JSON.stringify(child)}
              client={nextClient}
              node={child}
            />
          )}
        />
      );
    case "button":
      return <PageActionButton client={client} node={node} />;
    case "tabs":
      return <Tabs client={client} node={node} />;
    case "form":
      return <ActionForm client={client} node={node} />;
    case "select":
      return (
        <select
          aria-label={node.props.label ?? node.props.name}
          className="min-h-[34px] border border-border-strong bg-background px-2.5 text-primary"
        >
          {node.props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "text-input":
      return (
        <Input
          aria-label={node.props.label ?? node.props.name}
          type={node.props.secret ? "password" : "text"}
          defaultValue={node.props.value}
          placeholder={node.props.placeholder}
        />
      );
  }
}
