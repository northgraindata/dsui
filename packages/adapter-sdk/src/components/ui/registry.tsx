import type { ComponentType } from "react";
import type { ComponentProps } from "../runtime";
import BadgeView from "./badge";
import ButtonView from "./button";
import CodeBlockView from "./code-block";
import CodeExplorerView from "./code-explorer";
import CollectionView from "./collection";
import FormView from "./form";
import IconView from "./icon";
import KeyValueView from "./key-value";
import CardView from "./layout/card";
import ColumnsView from "./layout/columns";
import FlexView from "./layout/flex";
import GaugeView from "./layout/gauge";
import GridView from "./layout/grid";
import MeterView from "./layout/meter";
import SectionView from "./layout/section";
import StackView from "./layout/stack";
import LinkView from "./link";
import ListView from "./list";
import NotebookView from "./notebook/notebook";
import NotebookCatalogView from "./notebook-catalog";
import PageHeaderView from "./page-header";
import QueryEditorView from "./query-editor/query-editor";
import ResourceView from "./resource";
import ResourceTreeView from "./resource-tree";
import SelectView from "./select";
import SplitPaneView from "./split-pane";
import TableView from "./table";
import TabsView from "./tabs";
import TargetView from "./target";
import TextInputView from "./text-input";
import ValueView from "./value";

/**
 * Ids of the components the SDK renders itself. A node names one either as its
 * `kind` or, for browser references, as its `component`. `chart` is not listed:
 * the renderer provides it, because it owns the charting library.
 */
export const BUILTIN_COMPONENT_IDS = [
  "badge",
  "button",
  "card",
  "code-block",
  "code-explorer",
  "collection",
  "columns",
  "flex",
  "form",
  "gauge",
  "grid",
  "icon",
  "key-value",
  "link",
  "list",
  "meter",
  "notebook",
  "notebook-catalog",
  "page-header",
  "query-editor",
  "resource",
  "resource-tree",
  "section",
  "select",
  "split-pane",
  "stack",
  "table",
  "tabs",
  "target",
  "text-input",
  "value",
] as const;

export type BuiltinComponentId = (typeof BUILTIN_COMPONENT_IDS)[number];

/** Explicit, so a listed component without a view is a type error. */
export const builtinComponents: Record<
  BuiltinComponentId,
  ComponentType<ComponentProps>
> = {
  badge: BadgeView,
  button: ButtonView,
  card: CardView,
  "code-block": CodeBlockView,
  "code-explorer": CodeExplorerView,
  collection: CollectionView,
  columns: ColumnsView,
  flex: FlexView,
  form: FormView,
  gauge: GaugeView,
  grid: GridView,
  icon: IconView,
  "key-value": KeyValueView,
  link: LinkView,
  list: ListView,
  meter: MeterView,
  notebook: NotebookView,
  "notebook-catalog": NotebookCatalogView,
  "page-header": PageHeaderView,
  "query-editor": QueryEditorView,
  resource: ResourceView,
  "resource-tree": ResourceTreeView,
  section: SectionView,
  select: SelectView,
  "split-pane": SplitPaneView,
  stack: StackView,
  table: TableView,
  tabs: TabsView,
  target: TargetView,
  "text-input": TextInputView,
  value: ValueView,
};
