import type { z } from "zod";
import type { ActionTarget, AnyActionDefinition } from "../action/index";
import type { DataSource } from "../resource/index";

/**
 * Page header: title, optional description, optional header actions.
 */
export interface PageHeaderProps {
  /** Page title, e.g. the database name. */
  title: string;
  /** One-line subtitle. */
  description?: string;
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
  /** Visual weight. */
  variant?: "primary" | "secondary" | "danger";
  /** Action definition or id; the wire carries the id. */
  action: AnyActionDefinition | string;
  /** Action-input field -> row field. */
  input?: Record<string, string>;
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
  /** Action binding executed on click. */
  action?: ActionTarget;
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

/** A browser-owned editor that submits its current text to an action. */
export interface QueryWorkbenchProps {
  /** Language id understood by the renderer's syntax highlighter. */
  language: string;
  /** Initial editor contents. Editing remains browser-owned. */
  value?: string;
  /** Action definition receiving `{ sql: editorContents }`. */
  action: AnyActionDefinition | string;
  /** Optional catalog list rendered beside the editor. */
  explorer?: QueryExplorerProps;
}

/** A resource-backed level in a query workbench explorer tree. */
export interface QueryExplorerProps {
  /** Resource providing the rows at this level. */
  source: DataSource;
  /** Field displayed as the tree item's label. Defaults to `name`. */
  nameField?: string;
  /** Child level. `$field` values in its source input use the selected row. */
  children?: QueryExplorerProps;
}

/** Query workbench node (`"query-workbench"`). */
export interface QueryWorkbenchNode {
  readonly kind: "query-workbench";
  readonly props: QueryWorkbenchProps;
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
 * Any UI node a page render can return. Renderers switch exhaustively
 * over `kind`; adding a kind without renderer support is a compile error
 * on the renderer side.
 */
export type ComponentNode =
  | PageHeaderNode
  | TableNode
  | DependencyGraphNode
  | ButtonNode
  | TabsNode
  | KeyValueNode
  | CodeEditorNode
  | QueryWorkbenchNode
  | ResourceTreeNode
  | SplitPaneNode
  | SelectNode
  | TextInputNode
  | FormNode;

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
export function PageHeader(props: PageHeaderProps): PageHeaderNode {
  if (!props.title) throw new Error("PageHeader requires a title");
  return { kind: "page-header", props: { ...props } };
}

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
export function Table(props: TableProps): TableNode {
  if (props.rowLink && !props.rowLink.path.startsWith("/"))
    throw new Error("Table rowLink path must be absolute");
  return { kind: "table", props: { ...props } };
}

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
export function DependencyGraph(
  props: DependencyGraphProps,
): DependencyGraphNode {
  if (!props.idField || !props.dependsOnField)
    throw new Error("DependencyGraph requires idField and dependsOnField");
  if (props.rowLink && !props.rowLink.path.startsWith("/"))
    throw new Error("DependencyGraph rowLink path must be absolute");
  return { kind: "dependency-graph", props: { ...props } };
}

/**
 * Button factory.
 *
 * @param props - Label, optional action binding, and variant.
 * @throws An error when the label is empty.
 *
 * @example
 * ```ts
 * Button({ label: "Resume", action: resumeWarehouse({ warehouse: "ETL_WH" }) });
 * ```
 */
export function Button(props: ButtonProps): ButtonNode {
  if (!props.label) throw new Error("Button requires a label");
  return { kind: "button", props: { ...props } };
}

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
export function Tabs(props: TabsProps): TabsNode {
  if (props.items.length === 0)
    throw new Error("Tabs requires at least one item");
  return { kind: "tabs", props: { items: [...props.items] } };
}

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
export function KeyValue(props: KeyValueProps): KeyValueNode {
  return { kind: "key-value", props: { ...props } };
}

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
export function CodeEditor(props: CodeEditorProps): CodeEditorNode {
  return { kind: "code-editor", props: { ...props } };
}

/**
 * A query editor and result workspace owned by the browser renderer.
 *
 * @example
 * ```ts
 * QueryWorkbench({ language: "sql", action: runQuery });
 * ```
 */
export function QueryWorkbench(props: QueryWorkbenchProps): QueryWorkbenchNode {
  if (!props.language) throw new Error("QueryWorkbench requires a language");
  return { kind: "query-workbench", props: { ...props } };
}

/** A lazy resource-backed navigation tree rendered and controlled by DSUI. */
export function ResourceTree(props: ResourceTreeProps): ResourceTreeNode {
  if (!props.label) throw new Error("ResourceTree requires a label");
  return { kind: "resource-tree", props: { ...props } };
}

/** A responsive sidebar/content layout for ordinary DSUI page nodes. */
export function SplitPane(props: SplitPaneProps): SplitPaneNode {
  return { kind: "split-pane", props: { ...props } };
}

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
export function Select(props: SelectProps): SelectNode {
  if (!props.name) throw new Error("Select requires a field name");
  return { kind: "select", props: { ...props, options: [...props.options] } };
}

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
export function TextInput(props: TextInputProps): TextInputNode {
  if (!props.name) throw new Error("TextInput requires a field name");
  return { kind: "text-input", props: { ...props } };
}

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
export function Form(props: FormProps): FormNode {
  return {
    kind: "form",
    props: { ...props, fields: props.fields ? [...props.fields] : undefined },
  };
}
