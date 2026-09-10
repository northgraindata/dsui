import type { ComponentType } from "react";
import { ButtonView } from "../components/button";
import { DependencyGraphView } from "../components/dependency-graph/dependency-graph";
import {
  EntityCatalogView,
  EntityDetailView,
} from "../components/entity/entity-views";
import { ActionForm } from "../components/form";
import { KeyValueView } from "../components/key-value";
import {
  ActionListView,
  CardListView,
  ColumnsView,
  MeterView,
  SectionView,
  StatGridView,
} from "../components/overview-views";
import { PageHeaderView } from "../components/page-header";
import { QueryEditorView } from "../components/query-editor/query-editor";
import { ResourceTreeView } from "../components/resource-tree";
import { SelectView } from "../components/select";
import { SplitPaneView } from "../components/split-pane";
import { TableView } from "../components/table";
import { Tabs } from "../components/tabs";
import { TextInputView } from "../components/text-input";
import { type RegistryViewProps, registerView } from "./view-registry";

const entityCatalogView: ComponentType<RegistryViewProps> = ({
  client,
  node,
}) =>
  node.kind === "entity-catalog" ? (
    <EntityCatalogView client={client} node={node} />
  ) : null;

const entityDetailView: ComponentType<RegistryViewProps> = ({
  client,
  node,
}) =>
  node.kind === "entity-detail" ? (
    <EntityDetailView client={client} node={node} />
  ) : null;

const statGridView: ComponentType<RegistryViewProps> = ({ client, node }) =>
  node.kind === "stat-grid" ? (
    <StatGridView client={client} node={node} />
  ) : null;

const sectionView: ComponentType<RegistryViewProps> = ({
  client,
  node,
  renderNode,
}) =>
  node.kind === "section" ? (
    <SectionView client={client} node={node} renderNode={renderNode} />
  ) : null;

const cardListView: ComponentType<RegistryViewProps> = ({ client, node }) =>
  node.kind === "card-list" ? (
    <CardListView client={client} node={node} />
  ) : null;

const actionListView: ComponentType<RegistryViewProps> = ({ client, node }) =>
  node.kind === "action-list" ? (
    <ActionListView client={client} node={node} />
  ) : null;

const columnsView: ComponentType<RegistryViewProps> = ({
  client,
  node,
  renderNode,
}) =>
  node.kind === "columns" ? (
    <ColumnsView client={client} node={node} renderNode={renderNode} />
  ) : null;

const meterView: ComponentType<RegistryViewProps> = ({ client, node }) =>
  node.kind === "meter" ? <MeterView client={client} node={node} /> : null;

const dependencyGraphView: ComponentType<RegistryViewProps> = ({
  client,
  node,
}) =>
  node.kind === "dependency-graph" ? (
    <DependencyGraphView client={client} node={node} />
  ) : null;

const firstPartyViews: readonly [string, ComponentType<RegistryViewProps>][] = [
  ["button", ButtonView],
  ["dependency-graph", dependencyGraphView],
  ["form", ActionForm],
  ["key-value", KeyValueView],
  ["page-header", PageHeaderView],
  ["query-editor", QueryEditorView],
  ["resource-tree", ResourceTreeView],
  ["select", SelectView],
  ["split-pane", SplitPaneView],
  ["table", TableView],
  ["tabs", Tabs],
  ["text-input", TextInputView],
  ["entity-catalog", entityCatalogView],
  ["entity-detail", entityDetailView],
  ["stat-grid", statGridView],
  ["section", sectionView],
  ["card-list", cardListView],
  ["action-list", actionListView],
  ["columns", columnsView],
  ["meter", meterView],
];

export function registerFirstPartyViews(): void {
  for (const [id, view] of firstPartyViews) registerView(id, view);
}
