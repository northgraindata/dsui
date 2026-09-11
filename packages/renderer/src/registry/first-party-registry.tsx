import type { ComponentType } from "react";
import { ButtonView } from "../components/button";
import { BadgeView } from "../components/badge";
import { ActionForm } from "../components/form";
import { KeyValueView } from "../components/key-value";
import { CardView } from "../components/layout/card";
import { GridView } from "../components/layout/grid";
import { FlexView } from "../components/layout/flex";
import { StackView } from "../components/layout/stack";
import { ValueView } from "../components/value";
import { IconView } from "../components/icon";
import { CollectionView } from "../components/collection";
import { ColumnsView } from "../components/layout/columns";
import { MeterView } from "../components/layout/meter";
import { SectionView } from "../components/layout/section";
import { PageHeaderView } from "../components/page-header";
import { QueryEditorView } from "../components/query-editor/query-editor";
import { ResourceTreeView } from "../components/resource-tree";
import { ResourceView } from "../components/resource";
import { LinkView } from "../components/link";
import { CodeBlockView } from "../components/code-block";
import { SelectView } from "../components/select";
import { SplitPaneView } from "../components/split-pane";
import { TableView } from "../components/table";
import { Tabs } from "../components/tabs";
import { TextInputView } from "../components/text-input";
import { type RegistryViewProps, registerView } from "./view-registry";

const sectionView: ComponentType<RegistryViewProps> = ({
  client,
  node,
  renderNode,
}) =>
  node.kind === "section" ? (
    <SectionView client={client} node={node} renderNode={renderNode} />
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

const firstPartyViews: readonly [string, ComponentType<RegistryViewProps>][] = [
  ["button", ButtonView],
  ["badge", BadgeView],
  ["card", CardView],
  ["collection", CollectionView],
  ["form", ActionForm],
  ["flex", FlexView],
  ["grid", GridView],
  ["key-value", KeyValueView],
  ["page-header", PageHeaderView],
  ["query-editor", QueryEditorView],
  ["resource-tree", ResourceTreeView],
  ["resource", ResourceView],
  ["link", LinkView],
  ["code-block", CodeBlockView],
  ["select", SelectView],
  ["split-pane", SplitPaneView],
  ["table", TableView],
  ["tabs", Tabs],
  ["text-input", TextInputView],
  ["value", ValueView],
  ["icon", IconView],
  ["stack", StackView],
  ["section", sectionView],
  ["columns", columnsView],
  ["meter", meterView],
];

export function registerFirstPartyViews(): void {
  for (const [id, view] of firstPartyViews) registerView(id, view);
}
