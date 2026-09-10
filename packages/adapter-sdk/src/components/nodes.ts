import type { ActionIcon } from "@northgraindata/dsui-core";
import type { z } from "zod";
import type { ActionTarget, AnyActionDefinition } from "../action/index";
import type { DataSource } from "../resource/index";
import { defineComponent } from "./custom";

/**
 * Page header: title, optional description, status badge, meta line, and
 * optional header actions (links or action bindings).
 */
export interface PageHeaderProps {
  /** Page title, e.g. the database name. */
  title: string;
  /** One-line subtitle. */
  description?: string;
  /** Status pill beside the title. */
  badge?: {
    label: string;
    tone?: "healthy" | "warning" | "unavailable" | "info";
  };
  /** Secondary line under the description, e.g. a file path. */
  meta?: string;
  /** Buttons rendered beside the title. */
  actions?: ButtonNode[];
}

/**
 * Page header node (`"page-header"`).
 */
export interface PageHeaderNode {
  /** Discriminant: always `"page-header"`. */
  readonly kind: "page-header";
  /** Header content. */
  readonly props: PageHeaderProps;
}

/**
 * Table column override. Omit `columns` to let the renderer derive
 * columns from the data.
 */
export interface TableColumn {
  /** Row field read for this column. */
  id: string;
  /** Column header label. */
  label: string;
}

/**
 * Declarative row deep-link. Params map URL param names to row field
 * names; the renderer URL-encodes substituted values.
 *
 * @example
 * ```ts
 * rowLink: {
 *   path: "/warehouses/:warehouse",
 *   params: { warehouse: "name" },
 * },
 * ```
 */
export interface TableRowLink {
  /** Adapter page path with :param placeholders. */
  path: string;
  /** URL param name -> row field name. */
  params: Record<string, string>;
}

/**
 * Dependency graph: rows that each name the rows they depend on. The
 * renderer derives layers from the edges; adapters supply no geometry.
 */
export interface DependencyGraphProps {
  /** Resource binding producing one row per graph node. */
  source?: DataSource;
  /** Static rows; the escape hatch when no resource exists. */
  data?: readonly unknown[];
  /** Row field holding the unique node id. */
  idField: string;
  /** Row field holding an array of ids this node depends on. */
  dependsOnField: string;
  /** Row field rendered as the node title; defaults to `idField`. */
  labelField?: string;
  /** Row field rendered under the title, e.g. an operator name. */
  detailField?: string;
  /** Row field rendered as the node's current execution state. */
  stateField?: string;
  /** Deep link followed when a node is activated. */
  rowLink?: TableRowLink;
}

/**
 * Dependency graph node (`"dependency-graph"`).
 */
export interface DependencyGraphNode {
  /** Discriminant: always `"dependency-graph"`. */
  readonly kind: "dependency-graph";
  /** Graph content. */
  readonly props: DependencyGraphProps;
}

/**
 * Declarative per-row button. Inputs map action-input fields to row
 * field names and are substituted renderer-side, then validated by the
 * normal action execution path.
 *
 * @example
 * ```ts
 * rowActions: [
 *   {
 *     label: "Resume",
 *     action: resumeWarehouse,
 *     input: { warehouse: "name" },
 *     when: { field: "status", equals: "SUSPENDED" },
 *   },
 * ],
 * ```
 */
export interface TableRowAction {
  /** Button label. */
  label: string;
  /** Optional renderer-owned visual cue shown beside the label. */
  icon?: ActionIcon;
  /** Visual weight. */
  variant?: "primary" | "secondary" | "danger";
  /** Action definition or id; the wire carries the id. */
  action: AnyActionDefinition | string;
  /** Action-input field -> row field. */
  input?: Record<string, string>;
  /** Adapter page opened from fields in successful action data. */
  successLink?: TableRowLink;
  /** Show only when the row matches every present clause. */
  when?: {
    field: string;
    equals?: string | number | boolean;
    notEquals?: string | number | boolean;
  };
}

/**
 * Data table props.
 *
 * @example
 * ```ts
 * Table({
 *   source: warehouses(),
 *   rowLink: { path: "/warehouses/:warehouse", params: { warehouse: "name" } },
 *   rowActions: [
 *     { label: "Resume", action: resumeWarehouse, input: { warehouse: "name" }, when: { field: "status", equals: "SUSPENDED" } },
 *     { label: "Suspend", action: suspendWarehouse, input: { warehouse: "name" }, when: { field: "status", notEquals: "SUSPENDED" } },
 *   ],
 * });
 * ```
 */
export interface TableProps {
  /** Resource binding providing rows (preferred for external data). */
  source?: DataSource;
  /**
   * Escape hatch for local/static rows; prefer `source` for external data.
   */
  data?: readonly Record<string, unknown>[];
  /** Column overrides; omitted derives columns from the data. */
  columns?: readonly TableColumn[];
  /** Deep link for row clicks, substituted from row fields. */
  rowLink?: TableRowLink;
  /** Per-row buttons, substituted from row fields. */
  rowActions?: readonly TableRowAction[];
}

/**
 * Table node (`"table"`).
 */
export interface TableNode {
  /** Discriminant: always `"table"`. */
  readonly kind: "table";
  /** Table content. */
  readonly props: TableProps;
}

/**
 * Button props.
 */
export interface ButtonProps {
  /** Button label. */
  label: string;
  /** Optional renderer-owned visual cue shown beside the label. */
  icon?: ActionIcon;
  /** Action binding executed on click. */
  action?: ActionTarget;
  /** Adapter page opened from fields in successful action data. */
  successLink?: TableRowLink;
  /** Adapter page path; mutually exclusive with `action`. */
  link?: string;
  /** Visual weight. */
  variant?: "primary" | "secondary" | "danger";
}

/**
 * Button node (`"button"`).
 */
export interface ButtonNode {
  /** Discriminant: always `"button"`. */
  readonly kind: "button";
  /** Button content. */
  readonly props: ButtonProps;
}

/**
 * One tab: label plus nested content.
 */
export interface TabsItem {
  /** Tab label. */
  label: string;
  /** Tab content (one node or many). */
  content: ComponentNode | readonly ComponentNode[];
}

/**
 * Tabs props. Requires at least one item.
 */
export interface TabsProps {
  /** Tabs in display order. */
  items: readonly TabsItem[];
}

/**
 * Tabs node (`"tabs"`).
 */
export interface TabsNode {
  /** Discriminant: always `"tabs"`. */
  readonly kind: "tabs";
  /** Tabs content. */
  readonly props: TabsProps;
}

/**
 * Key/value detail props.
 */
export interface KeyValueProps {
  /** Optional section title. */
  title?: string;
  /** Resource binding providing the record (preferred for external data). */
  source?: DataSource;
  /**
   * Escape hatch for local/static entries; prefer `source` for external data.
   */
  data?: Readonly<Record<string, unknown>>;
}

/**
 * Key/value node (`"key-value"`).
 */
export interface KeyValueNode {
  /** Discriminant: always `"key-value"`. */
  readonly kind: "key-value";
  /** Detail content. */
  readonly props: KeyValueProps;
}

/**
 * Code editor props. Editing state lives in a store; bind `value` and
 * `onChange` to it.
 *
 * @example
 * ```ts
 * CodeEditor({ language: "sql", value: editor.sql, onChange: editor.setSql });
 * ```
 */
export interface CodeEditorProps {
  /** Language for highlighting, e.g. `"sql"`. */
  language: string;
  /** Current content (store-backed). */
  value: string;
  /** Called with the new content on every edit. */
  onChange?: (value: string) => void;
}

/**
 * Code editor node (`"code-editor"`).
 */
export interface CodeEditorNode {
  /** Discriminant: always `"code-editor"`. */
  readonly kind: "code-editor";
  /** Editor content. */
  readonly props: CodeEditorProps;
}

/** A browser-owned query editor that submits its current text to an action. */
export interface QueryEditorProps {
  /** Language id understood by the renderer's syntax highlighter. */
  language: string;
  /** Initial editor contents. Editing remains browser-owned. */
  value?: string;
  /** Action definition receiving `{ sql: editorContents }`. */
  action: AnyActionDefinition | string;
  /** Optional catalog list rendered beside the editor. */
  explorer?: QueryEditorExplorerProps;
}

/** A resource-backed level in a query editor explorer tree. */
export interface QueryEditorExplorerProps {
  /** Resource providing the rows at this level. */
  source: DataSource;
  /** Field displayed as the tree item's label. Defaults to `name`. */
  nameField?: string;
  /** Child level. `$field` values in its source input use the selected row. */
  children?: QueryEditorExplorerProps;
}

/** Query editor node (`"query-editor"`). */
export interface QueryEditorNode {
  readonly kind: "query-editor";
  readonly props: QueryEditorProps;
}

/** One lazy, resource-backed level in a navigable tree. */
export interface ResourceTreeBranchProps {
  source: DataSource;
  nameField?: string;
  typeField?: string;
  rowLink?: TableRowLink;
  children?: ResourceTreeBranchProps;
}

export interface ResourceTreeProps {
  label: string;
  branch: ResourceTreeBranchProps;
  selectedPath?: string;
  stateKey?: string;
  searchPlaceholder?: string;
}

export interface ResourceTreeNode {
  readonly kind: "resource-tree";
  readonly props: ResourceTreeProps;
}

export interface SplitPaneProps {
  sidebar: ComponentNode | readonly ComponentNode[];
  content: ComponentNode | readonly ComponentNode[];
  /** Optional details rail, stacked below content on narrow screens. */
  inspector?: ComponentNode | readonly ComponentNode[];
}

export interface SplitPaneNode {
  readonly kind: "split-pane";
  readonly props: SplitPaneProps;
}

/**
 * One select option.
 */
export interface SelectOption {
  /** Visible label. */
  label: string;
  /** Submitted value. */
  value: string;
}

/**
 * Select props. Option lists are plain arrays; populating them from
 * resources is renderer-owned.
 */
export interface SelectProps {
  /** Field name (form) or identifier. */
  name: string;
  /** Visible label. */
  label?: string;
  /** Available options. */
  options: readonly SelectOption[];
  /** Current value. */
  value?: string | null;
  /** Called with the new value on change. */
  onChange?: (value: string | null) => void;
  /** Placeholder when nothing is selected. */
  placeholder?: string;
}

/**
 * Select node (`"select"`).
 */
export interface SelectNode {
  /** Discriminant: always `"select"`. */
  readonly kind: "select";
  /** Select content. */
  readonly props: SelectProps;
}

/**
 * Text input props. Binds directly to store state and actions.
 *
 * @example
 * ```ts
 * TextInput({
 *   name: "warehouse",
 *   label: "Warehouse",
 *   value: session.warehouse ?? "",
 *   onChange: (value) => session.setWarehouse(value || null),
 * });
 * ```
 */
export interface TextInputProps {
  /** Field name (form) or identifier. */
  name: string;
  /** Visible label. */
  label?: string;
  /** Current value (store-backed). */
  value?: string;
  /** Called with the new value on every edit. */
  onChange?: (value: string) => void;
  /** Placeholder text. */
  placeholder?: string;
  /** Masks input for secrets. */
  secret?: boolean;
}

/**
 * Text input node (`"text-input"`).
 */
export interface TextInputNode {
  /** Discriminant: always `"text-input"`. */
  readonly kind: "text-input";
  /** Input content. */
  readonly props: TextInputProps;
}

/**
 * Form props. The Zod schema is shared with the submitted action's
 * input schema; the runtime validates before invoking the action.
 *
 * @example
 * ```ts
 * Form({
 *   schema: resizeWarehouseInput,
 *   fields: [
 *     TextInput({ name: "warehouse", label: "Warehouse" }),
 *     Select({ name: "size", label: "Size", options: SIZES }),
 *   ],
 *   onSubmit: resizeWarehouse,
 *   submitLabel: "Resize warehouse",
 * });
 * ```
 */
export interface FormProps {
  /** Zod input schema shared with the submitted action. */
  schema: z.ZodTypeAny;
  /** Field components rendered in order. */
  fields?: readonly ComponentNode[];
  /**
   * The action invoked with validated form data. Accepts either a bound
   * action or an action definition (bound by the runtime on submit).
   */
  onSubmit: ActionTarget | { readonly kind: "action"; readonly id: string };
  /** Submit button label. */
  submitLabel?: string;
}

/**
 * Form node (`"form"`).
 */
export interface FormNode {
  /** Discriminant: always `"form"`. */
  readonly kind: "form";
  /** Form content. */
  readonly props: FormProps;
}

/**
 * One statistic: an icon, a record field read for the value, and a label.
 */
export interface StatGridItem {
  /** Icon id; the renderer falls back to a default glyph when unknown. */
  icon?: string;
  /** Record field read for the value. */
  field: string;
  /** Label under the value. */
  label: string;
}

/**
 * Statistic cards props. Values come from one record, like KeyValue.
 *
 * @example
 * ```ts
 * StatGrid({
 *   source: overviewStats(),
 *   items: [{ icon: "database", field: "size", label: "Database size" }],
 * });
 * ```
 */
export interface StatGridProps {
  /** Resource binding providing the record (preferred for external data). */
  source?: DataSource;
  /** Escape hatch for static records; prefer `source` for external data. */
  data?: Readonly<Record<string, unknown>>;
  /** Cards in display order; requires at least one item. */
  items: readonly StatGridItem[];
}

/**
 * Statistic cards node (`"stat-grid"`).
 */
export interface StatGridNode {
  /** Discriminant: always `"stat-grid"`. */
  readonly kind: "stat-grid";
  /** Statistic cards content. */
  readonly props: StatGridProps;
}

/**
 * Titled section props. Groups one panel: heading, optional link, content.
 *
 * @example
 * ```ts
 * Section({
 *   title: "Recent tables",
 *   link: { label: "View all", path: "/data" },
 *   content: Table({ source: recentTables() }),
 * });
 * ```
 */
export interface SectionLink {
  label: string;
  /** Adapter page path. */
  path: string;
}

export interface SectionProps {
  /** Section heading. */
  title: string;
  /** One-line description under the heading. */
  description?: string;
  /** Link rendered beside the heading. */
  link?: SectionLink;
  /** Section content (one node or many). */
  content: ComponentNode | readonly ComponentNode[];
}

/**
 * Titled section node (`"section"`).
 */
export interface SectionNode {
  /** Discriminant: always `"section"`. */
  readonly kind: "section";
  /** Section content. */
  readonly props: SectionProps;
}

/**
 * One grid column: relative width plus nested content.
 */
export interface ColumnsColumn {
  /** Relative width in fractional units; defaults to 1. */
  weight?: number;
  /** Column content (one node or many). */
  content: ComponentNode | readonly ComponentNode[];
}

/**
 * Multi-column layout props for pairing panels side by side. The
 * renderer collapses to one column on narrow screens.
 *
 * @example
 * ```ts
 * Columns({
 *   columns: [
 *     { weight: 2, content: Section({ title: "Attached databases", content: cards }) },
 *     { weight: 1, content: Section({ title: "Quick actions", content: actions }) },
 *   ],
 * });
 * ```
 */
export interface ColumnsProps {
  /** Columns in display order; requires at least one column. */
  columns: readonly ColumnsColumn[];
}

/**
 * Multi-column layout node (`"columns"`).
 */
export interface ColumnsNode {
  /** Discriminant: always `"columns"`. */
  readonly kind: "columns";
  /** Multi-column layout content. */
  readonly props: ColumnsProps;
}

/**
 * One entity card. Resource rows use the same field names.
 */
export interface OverviewCard {
  /** Card title. */
  title: string;
  /** One-line description under the title. */
  description?: string;
  /** Status pill, e.g. "Primary" or "Loaded". */
  badge?: string;
  /** Pill tone. */
  badgeTone?: "healthy" | "warning" | "unavailable" | "info";
  /** Icon id; the renderer falls back to a default glyph when unknown. */
  icon?: string;
  /** Short detail lines under the description. */
  meta?: readonly string[];
  /** Whole-card deep link, substituted from row fields for sources. */
  link?: TableRowLink;
}

/**
 * Entity cards props, e.g. attached databases or installed extensions.
 *
 * @example
 * ```ts
 * CardList({
 *   source: databases(),
 *   cards: [{ title: "main", badge: "Primary" }],
 * });
 * ```
 */
export interface CardListProps {
  /** Resource binding providing card-shaped rows. */
  source?: DataSource;
  /** Escape hatch for static cards; prefer `source` for external data. */
  cards?: readonly OverviewCard[];
  /** Fixed column count (1-4); defaults to a fluid fit. */
  columns?: number;
}

/**
 * Entity cards node (`"card-list"`).
 */
export interface CardListNode {
  /** Discriminant: always `"card-list"`. */
  readonly kind: "card-list";
  /** Entity cards content. */
  readonly props: CardListProps;
}

/**
 * One quick action: a link or action binding with an optional kbd hint.
 * `kbd` is display only; shortcut wiring is renderer-owned.
 */
export interface ActionListItem {
  /** Icon id; the renderer falls back to a default glyph when unknown. */
  icon?: string;
  /** Action title. */
  title: string;
  /** One-line description under the title. */
  description?: string;
  /** Keyboard hint rendered beside the item; display only. */
  kbd?: string;
  /** Adapter page path; mutually exclusive with `action`. */
  link?: string;
  /** Action binding executed on click. */
  action?: ActionTarget | string;
}

/**
 * Quick action list props.
 *
 * @example
 * ```ts
 * ActionList({
 *   items: [{ icon: "play", title: "New query", link: "/query", kbd: "⌘N" }],
 * });
 * ```
 */
export interface ActionListProps {
  /** Actions in display order; requires at least one item. */
  items: readonly ActionListItem[];
}

/**
 * Quick action list node (`"action-list"`).
 */
export interface ActionListNode {
  /** Discriminant: always `"action-list"`. */
  readonly kind: "action-list";
  /** Quick action list content. */
  readonly props: ActionListProps;
}

/**
 * Browser component reference props. The component is resolved by id
 * from the renderer's registry and lazy-loaded; `props` must be plain
 * JSON-serializable data.
 */
export interface CustomProps {
  /** Registry id, e.g. `"duckdb/table-card"`. */
  component: string;
  /** JSON-serializable props for the component. */
  props?: Record<string, unknown>;
}

/**
 * Browser component reference node (`"custom"`). Produced by
 * `defineComponent` in `path` mode; never hand-built.
 */
export interface CustomNode {
  /** Discriminant: always `"custom"`. */
  readonly kind: "custom";
  /** Component reference content. */
  readonly props: CustomProps;
}

/**
 * Any UI node a page render can return. Renderers switch exhaustively
 * over `kind`; adding a kind without renderer support is a compile error
 * on the renderer side.
 */
export type ComponentNode =
  | import("./entities").EntityCatalogNode
  | import("./entities").EntityDetailNode
  | PageHeaderNode
  | TableNode
  | DependencyGraphNode
  | ButtonNode
  | TabsNode
  | KeyValueNode
  | CodeEditorNode
  | QueryEditorNode
  | ResourceTreeNode
  | SplitPaneNode
  | SelectNode
  | TextInputNode
  | FormNode
  | StatGridNode
  | SectionNode
  | CardListNode
  | ActionListNode
  | ColumnsNode
  | MeterNode
  | CustomNode;

/**
 * Page header factory.
 *
 * @param props - Title, description, and header actions.
 * @throws An error when the title is empty.
 *
 * @example
 * ```ts
 * PageHeader({ title: "Warehouses" });
 * ```
 */
export const PageHeader = defineComponent<PageHeaderProps, PageHeaderNode>({
  id: "page-header",
  render: (props) => {
    if (!props.title) throw new Error("PageHeader requires a title");
    return { kind: "page-header", props: { ...props } };
  },
});

/**
 * Data table factory. Prefer `source` (resource binding) for external
 * data; `data` is the static escape hatch.
 *
 * @param props - Source or rows, columns, row link, and row actions.
 * @throws An error when the row-link path is not absolute.
 *
 * @example
 * ```ts
 * Table({ source: warehouses() });
 * ```
 */
export const Table = defineComponent<TableProps, TableNode>({
  id: "table",
  render: (props) => {
    if (props.rowLink && !props.rowLink.path.startsWith("/"))
      throw new Error("Table rowLink path must be absolute");
    if (
      props.rowActions?.some(
        (action) =>
          action.successLink && !action.successLink.path.startsWith("/"),
      )
    )
      throw new Error("Table action successLink path must be absolute");
    return { kind: "table", props: { ...props } };
  },
});

/**
 * Dependency graph factory. Rows describe nodes and their incoming
 * edges; the renderer computes layers, positions, and edge paths.
 *
 * @param props - Source or rows, id and dependency fields, node link.
 * @throws An error when a field name is empty or the link is relative.
 *
 * @example
 * ```ts
 * DependencyGraph({
 *   source: dagTasks({ dagId: "hourly" }),
 *   idField: "taskId",
 *   dependsOnField: "upstreamTaskIds",
 * });
 * ```
 */
export const DependencyGraph = defineComponent<
  DependencyGraphProps,
  DependencyGraphNode
>({
  id: "dependency-graph",
  render: (props) => {
    if (!props.idField || !props.dependsOnField)
      throw new Error("DependencyGraph requires idField and dependsOnField");
    if (props.rowLink && !props.rowLink.path.startsWith("/"))
      throw new Error("DependencyGraph rowLink path must be absolute");
    return { kind: "dependency-graph", props: { ...props } };
  },
});

/**
 * Button factory.
 *
 * @param props - Label, optional action binding or page link, and variant.
 * @throws An error when the label is empty or the link is not absolute.
 *
 * @example
 * ```ts
 * Button({ label: "Resume", action: resumeWarehouse({ warehouse: "ETL_WH" }) });
 * ```
 */
export const Button = defineComponent<ButtonProps, ButtonNode>({
  id: "button",
  render: (props) => {
    if (!props.label) throw new Error("Button requires a label");
    if (props.link && !props.link.startsWith("/"))
      throw new Error("Button link path must be absolute");
    if (props.successLink && !props.successLink.path.startsWith("/"))
      throw new Error("Button successLink path must be absolute");
    return { kind: "button", props: { ...props } };
  },
});

/**
 * Tabs factory.
 *
 * @param props - At least one labeled item with nested content.
 * @throws An error when no items are given.
 *
 * @example
 * ```ts
 * Tabs({ items: [{ label: "Preview", content: Table({ source: preview() }) }] });
 * ```
 */
export const Tabs = defineComponent<TabsProps, TabsNode>({
  id: "tabs",
  render: (props) => {
    if (props.items.length === 0)
      throw new Error("Tabs requires at least one item");
    return { kind: "tabs", props: { items: [...props.items] } };
  },
});

/**
 * Key/value detail factory.
 *
 * @param props - Optional title plus a resource binding or static record.
 *
 * @example
 * ```ts
 * KeyValue({ source: warehouseDetails({ warehouse: "ETL_WH" }) });
 * ```
 */
export const KeyValue = defineComponent<KeyValueProps, KeyValueNode>({
  id: "key-value",
  render: (props) => ({ kind: "key-value", props: { ...props } }),
});

/**
 * Code editor factory. Content is store-backed; the SDK owns no editor
 * state itself.
 *
 * @param props - Language, store value, and change handler.
 *
 * @example
 * ```ts
 * CodeEditor({ language: "sql", value: editor.sql, onChange: editor.setSql });
 * ```
 */
export const CodeEditor = defineComponent<CodeEditorProps, CodeEditorNode>({
  id: "code-editor",
  render: (props) => ({ kind: "code-editor", props: { ...props } }),
});

/**
 * A query editor and result workspace owned by the browser renderer.
 *
 * @example
 * ```ts
 * QueryEditor({ language: "sql", action: runQuery });
 * ```
 */
export const QueryEditor = defineComponent<QueryEditorProps, QueryEditorNode>({
  id: "query-editor",
  render: (props) => {
    if (!props.language) throw new Error("QueryEditor requires a language");
    return { kind: "query-editor", props: { ...props } };
  },
});

/** A lazy resource-backed navigation tree rendered and controlled by DSUI. */
export const ResourceTree = defineComponent<
  ResourceTreeProps,
  ResourceTreeNode
>({
  id: "resource-tree",
  render: (props) => {
    if (!props.label) throw new Error("ResourceTree requires a label");
    return { kind: "resource-tree", props: { ...props } };
  },
});

/** A responsive sidebar/content layout for ordinary DSUI page nodes. */
export const SplitPane = defineComponent<SplitPaneProps, SplitPaneNode>({
  id: "split-pane",
  render: (props) => ({ kind: "split-pane", props: { ...props } }),
});

/**
 * Select factory.
 *
 * @param props - Name, options, current value, and change handler.
 * @throws An error when the field name is empty.
 *
 * @example
 * ```ts
 * Select({ name: "size", label: "Size", options: SIZES });
 * ```
 */
export const Select = defineComponent<SelectProps, SelectNode>({
  id: "select",
  render: (props) => {
    if (!props.name) throw new Error("Select requires a field name");
    return { kind: "select", props: { ...props, options: [...props.options] } };
  },
});

/**
 * Text input factory.
 *
 * @param props - Name, store value, and change handler.
 * @throws An error when the field name is empty.
 *
 * @example
 * ```ts
 * TextInput({ name: "search", label: "Search", value: filters.search });
 * ```
 */
export const TextInput = defineComponent<TextInputProps, TextInputNode>({
  id: "text-input",
  render: (props) => {
    if (!props.name) throw new Error("TextInput requires a field name");
    return { kind: "text-input", props: { ...props } };
  },
});

/**
 * Form factory. Shares its schema with the submitted action; the
 * runtime validates before invoking it.
 *
 * @param props - Schema, fields, submit target, and submit label.
 *
 * @example
 * ```ts
 * Form({ schema: resizeWarehouseInput, onSubmit: resizeWarehouse });
 * ```
 */
export const Form = defineComponent<FormProps, FormNode>({
  id: "form",
  render: (props) => ({
    kind: "form",
    props: { ...props, fields: props.fields ? [...props.fields] : undefined },
  }),
});

function absolutePath(path: string | undefined, message: string): void {
  if (path && !path.startsWith("/")) throw new Error(message);
}

/**
 * Statistic cards factory.
 *
 * @param props - Record source or static record plus at least one item.
 * @throws An error when no items are given or an item field is empty.
 *
 * @example
 * ```ts
 * StatGrid({
 *   source: overviewStats(),
 *   items: [{ icon: "database", field: "size", label: "Database size" }],
 * });
 * ```
 */
export const StatGrid = defineComponent<StatGridProps, StatGridNode>({
  id: "stat-grid",
  render: (props) => {
    if (props.items.length === 0)
      throw new Error("StatGrid requires at least one item");
    for (const item of props.items)
      if (!item.field) throw new Error("StatGrid items require a field");
    return { kind: "stat-grid", props: { ...props, items: [...props.items] } };
  },
});

/**
 * Titled section factory.
 *
 * @param props - Heading, optional link, and nested content.
 * @throws An error when the title is empty or the link is not absolute.
 *
 * @example
 * ```ts
 * Section({ title: "Recent tables", content: Table({ source: tables() }) });
 * ```
 */
export const Section = defineComponent<SectionProps, SectionNode>({
  id: "section",
  render: (props) => {
    if (!props.title) throw new Error("Section requires a title");
    absolutePath(props.link?.path, "Section link path must be absolute");
    return { kind: "section", props: { ...props } };
  },
});

/**
 * Entity cards factory. Prefer `source` (resource binding) for external
 * data; `cards` is the static escape hatch.
 *
 * @param props - Source or cards; static card links must be absolute.
 * @throws An error when a static card link is not absolute.
 *
 * @example
 * ```ts
 * CardList({ source: databases() });
 * ```
 */
export const CardList = defineComponent<CardListProps, CardListNode>({
  id: "card-list",
  render: (props) => {
    for (const card of props.cards ?? [])
      absolutePath(card.link?.path, "CardList card link path must be absolute");
    if (
      props.columns !== undefined &&
      (!Number.isInteger(props.columns) ||
        props.columns < 1 ||
        props.columns > 4)
    )
      throw new Error("CardList columns must be an integer between 1 and 4");
    return {
      kind: "card-list",
      props: { ...props, cards: props.cards ? [...props.cards] : undefined },
    };
  },
});

/**
 * Multi-column layout factory.
 *
 * @param props - At least one column with nested content.
 * @throws An error when no columns are given.
 *
 * @example
 * ```ts
 * Columns({ columns: [{ content: Section({ title: "A", content }) }] });
 * ```
 */
export const Columns = defineComponent<ColumnsProps, ColumnsNode>({
  id: "columns",
  render: (props) => {
    if (props.columns.length === 0)
      throw new Error("Columns requires at least one column");
    return {
      kind: "columns",
      props: { ...props, columns: [...props.columns] },
    };
  },
});

/**
 * One meter segment: a labeled byte value with a tone.
 */
export interface MeterSegment {
  label: string;
  /** Segment size in bytes; must be finite and non-negative. */
  value: number;
  tone?: "info" | "healthy" | "warning" | "unavailable" | "muted" | "deep";
  /** Hide from the legend (still rendered in the bar); defaults to true. */
  legend?: boolean;
}

/**
 * Meter data: segments summing to the bar plus an optional footer line.
 */
export interface MeterData {
  segments: readonly MeterSegment[];
  footer?: string;
}

/**
 * Storage-meter props. The source returns one meter-shaped record.
 *
 * @example
 * ```ts
 * Meter({ source: storageMeter() });
 * ```
 */
export interface MeterProps {
  /** Resource binding providing the meter record. */
  source?: DataSource;
  /** Escape hatch for static meters; prefer `source` for external data. */
  data?: MeterData;
}

/**
 * Storage-meter node (`"meter"`).
 */
export interface MeterNode {
  /** Discriminant: always `"meter"`. */
  readonly kind: "meter";
  /** Storage-meter content. */
  readonly props: MeterProps;
}

/**
 * Storage-meter factory.
 *
 * @param props - Meter record source or static meter data.
 * @throws An error when static data has no segments or a segment value
 * is not a finite, non-negative number.
 *
 * @example
 * ```ts
 * Meter({ source: storageMeter() });
 * ```
 */
export const Meter = defineComponent<MeterProps, MeterNode>({
  id: "meter",
  render: (props) => {
    if (props.data) {
      if (props.data.segments.length === 0)
        throw new Error("Meter requires at least one segment");
      for (const segment of props.data.segments) {
        if (!segment.label) throw new Error("Meter segments require a label");
        if (!Number.isFinite(segment.value) || segment.value < 0)
          throw new Error(
            "Meter segment values must be finite and non-negative",
          );
      }
    }
    return {
      kind: "meter",
      props: {
        ...props,
        data: props.data
          ? { ...props.data, segments: [...props.data.segments] }
          : undefined,
      },
    };
  },
});

/**
 * Quick action list factory.
 *
 * @param props - At least one titled item with a link or action binding.
 * @throws An error when no items are given, a title is empty, or a link
 * is not absolute.
 *
 * @example
 * ```ts
 * ActionList({
 *   items: [{ icon: "play", title: "New query", link: "/query" }],
 * });
 * ```
 */
export const ActionList = defineComponent<ActionListProps, ActionListNode>({
  id: "action-list",
  render: (props) => {
    if (props.items.length === 0)
      throw new Error("ActionList requires at least one item");
    for (const item of props.items) {
      if (!item.title) throw new Error("ActionList items require a title");
      absolutePath(item.link, "ActionList item link path must be absolute");
    }
    return {
      kind: "action-list",
      props: { ...props, items: [...props.items] },
    };
  },
});
