import type { PageNode } from "@northgraindata/dsui-core";
import { Button, Input } from "@northgraindata/dsui-ui";
import { ActionForm } from "./ActionForm";
import { QueryWorkbench } from "./QueryWorkbench";
import { ResourceTreeView } from "./ResourceTree";
import { ResourceKeyValue, ResourceTable } from "./ResourceViews";
import { SplitPaneView } from "./SplitPane";
import { Tabs } from "./Tabs";
import type { RendererClient } from "./types";

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
      return (
        <Button
          variant={
            node.props.variant === "primary" ? "default" : node.props.variant
          }
          onClick={() =>
            node.props.action && client.executeAction(node.props.action)
          }
        >
          {node.props.label}
        </Button>
      );
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
