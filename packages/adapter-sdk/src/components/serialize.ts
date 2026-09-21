import type { ActionReference, ActionTarget } from "../action/index";
import type { ResourceReference } from "../resource";
import type { DataSource } from "../resource/index";
import type { PageNode } from "./nodes";
import type { CardProps } from "./primitives/card";
import type { CollectionProps } from "./primitives/collection";
import type { ColumnsColumn } from "./primitives/columns";
import type { FlexProps } from "./primitives/flex";
import type { GridProps } from "./primitives/grid";
import type { MeterSegment } from "./primitives/meter";
import type { NotebookBlock } from "./primitives/notebook";
import type {
  QueryEditorProps,
  QueryExplorerDocument,
} from "./primitives/query-editor";
import type { ResourceProps } from "./primitives/resource";
import type {
  ResourceTreeBranchDocument,
  ResourceTreeBranchProps,
} from "./primitives/resource-tree";
import type { StackProps } from "./primitives/stack";
import type {
  TableColumn,
  TableFilter,
  TableRowAction,
  TableRowMenuAction,
} from "./primitives/table";
import type { TabsItem } from "./primitives/tabs";
import type { ValueProps } from "./primitives/value";

/** Thrown when a live SDK node cannot cross the server/browser boundary. */
export class UnserializablePageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnserializablePageError";
  }
}

function resource(source: DataSource): ResourceReference {
  return {
    resourceId: source.resourceId,
    ...(source.input === undefined ? {} : { input: source.input }),
    ...(source.refresh ? { refresh: source.refresh } : {}),
  };
}

function action(
  target:
    | ActionTarget
    | { readonly kind: "action"; readonly id: string }
    | { readonly field: string }
    | string,
): ActionReference | { readonly field: string } {
  if (typeof target === "string") return { actionId: target };
  if ("field" in target) return target;
  return target.kind === "action-binding"
    ? { actionId: target.actionId, input: target.input }
    : { actionId: target.id };
}

function explorer(
  value: NonNullable<QueryEditorProps["explorer"]>,
): QueryExplorerDocument {
  return {
    source: resource(value.source),
    ...(value.nameField ? { nameField: value.nameField } : {}),
    ...(value.children ? { children: explorer(value.children) } : {}),
  };
}

function treeBranch(
  value: ResourceTreeBranchProps,
): ResourceTreeBranchDocument {
  return {
    source: resource(value.source),
    ...(value.nameField ? { nameField: value.nameField } : {}),
    ...(value.typeField ? { typeField: value.typeField } : {}),
    ...(value.rowLink
      ? {
          rowLink: {
            path: value.rowLink.path,
            params: { ...value.rowLink.params },
          },
        }
      : {}),
    ...(value.children ? { children: treeBranch(value.children) } : {}),
  };
}

function nodes(value: PageNode | readonly PageNode[]): readonly PageNode[] {
  return (Array.isArray(value) ? value : [value]).map(serializeNode);
}

/** Converts static SDK page nodes into the browser-safe page protocol. */
export function serializeNode(node: PageNode): PageNode {
  switch (node.kind) {
    case "page-header":
      return {
        kind: node.kind,
        props: {
          title: node.props.title,
          ...(node.props.description
            ? { description: node.props.description }
            : {}),
          ...(node.props.badge ? { badge: { ...node.props.badge } } : {}),
          ...(node.props.meta ? { meta: node.props.meta } : {}),
          ...(node.props.variant ? { variant: node.props.variant } : {}),
          ...(node.props.tags ? { tags: nodes(node.props.tags) } : {}),
          ...(node.props.actions ? { actions: nodes(node.props.actions) } : {}),
        },
      };
    case "table":
      return {
        kind: node.kind,
        props: {
          ...(node.props.source ? { source: resource(node.props.source) } : {}),
          ...(node.props.columnsSource
            ? { columnsSource: resource(node.props.columnsSource) }
            : {}),
          ...(node.props.data ? { data: node.props.data } : {}),
          ...(node.props.variant ? { variant: node.props.variant } : {}),
          ...(node.props.searchable ? { searchable: true } : {}),
          ...(node.props.filters
            ? {
                filters: node.props.filters.map((filter: TableFilter) => ({
                  field: filter.field,
                  label: filter.label,
                  options: filter.options.map((option) => ({ ...option })),
                })),
              }
            : {}),
          ...(node.props.pageSize ? { pageSize: node.props.pageSize } : {}),
          ...(node.props.columns
            ? {
                columns: node.props.columns.map((column: TableColumn) => ({
                  id: column.id,
                  label: column.label,
                  ...(column.format ? { format: column.format } : {}),
                  ...(column.renderCell
                    ? { renderCell: nodes(column.renderCell) }
                    : {}),
                })),
              }
            : {}),
          ...(node.props.rowLink
            ? {
                rowLink: {
                  path: node.props.rowLink.path,
                  params: { ...node.props.rowLink.params },
                },
              }
            : {}),
          ...(node.props.rowActions
            ? {
                rowActions: node.props.rowActions.map(
                  (rowAction: TableRowAction) => ({
                    label: rowAction.label,
                    ...(rowAction.icon ? { icon: rowAction.icon } : {}),
                    ...(rowAction.variant
                      ? { variant: rowAction.variant }
                      : {}),
                    ...(rowAction.action
                      ? {
                          action: {
                            actionId:
                              typeof rowAction.action === "string"
                                ? rowAction.action
                                : rowAction.action.id,
                            ...(rowAction.input
                              ? { input: { ...rowAction.input } }
                              : {}),
                          },
                        }
                      : {}),
                    ...(rowAction.link
                      ? {
                          link: {
                            path: rowAction.link.path,
                            params: { ...rowAction.link.params },
                          },
                        }
                      : {}),
                    ...(rowAction.successLink
                      ? {
                          successLink: {
                            path: rowAction.successLink.path,
                            params: { ...rowAction.successLink.params },
                          },
                        }
                      : {}),
                    ...(rowAction.when ? { when: { ...rowAction.when } } : {}),
                    ...(rowAction.disabledWhen
                      ? { disabledWhen: { ...rowAction.disabledWhen } }
                      : {}),
                    ...(rowAction.confirmation
                      ? { confirmation: { ...rowAction.confirmation } }
                      : {}),
                  }),
                ),
              }
            : {}),
          ...(node.props.actions
            ? {
                actions: node.props.actions.map(
                  (rowAction: TableRowMenuAction) => ({
                    label: rowAction.label,
                    ...(rowAction.link
                      ? {
                          link: {
                            path: rowAction.link.path,
                            params: { ...rowAction.link.params },
                          },
                        }
                      : {}),
                    ...(rowAction.action
                      ? {
                          action: {
                            actionId:
                              typeof rowAction.action === "string"
                                ? rowAction.action
                                : rowAction.action.id,
                            ...(rowAction.input
                              ? { input: { ...rowAction.input } }
                              : {}),
                          },
                        }
                      : {}),
                    ...(rowAction.successLink
                      ? {
                          successLink: {
                            path: rowAction.successLink.path,
                            params: { ...rowAction.successLink.params },
                          },
                        }
                      : {}),
                    ...(rowAction.when ? { when: { ...rowAction.when } } : {}),
                    ...(rowAction.confirmation
                      ? { confirmation: { ...rowAction.confirmation } }
                      : {}),
                  }),
                ),
              }
            : {}),
        },
      };
    case "button":
      return {
        kind: node.kind,
        props: {
          label: node.props.label,
          ...(node.props.icon ? { icon: node.props.icon } : {}),
          ...(node.props.description
            ? { description: node.props.description }
            : {}),
          ...(node.props.kbd ? { kbd: node.props.kbd } : {}),
          ...(node.props.variant ? { variant: node.props.variant } : {}),
          ...(node.props.action ? { action: action(node.props.action) } : {}),
          ...(node.props.successLink
            ? {
                successLink: {
                  path: node.props.successLink.path,
                  params: { ...node.props.successLink.params },
                },
              }
            : {}),
          ...(node.props.link ? { link: node.props.link } : {}),
          ...(node.props.confirmation
            ? { confirmation: node.props.confirmation }
            : {}),
        },
      };
    case "icon":
      return {
        kind: node.kind,
        props: {
          name: node.props.name,
          ...(node.props.size ? { size: node.props.size } : {}),
        },
      };
    case "badge":
      return {
        kind: node.kind,
        props: {
          label: node.props.label,
          ...(node.props.tone ? { tone: node.props.tone } : {}),
          ...(node.props.dot ? { dot: true } : {}),
        },
      };
    case "tabs":
      return {
        kind: node.kind,
        props: {
          items: node.props.items.map((item: TabsItem) => ({
            label: item.label,
            content: nodes(item.content),
            ...(item.link ? { link: item.link } : {}),
          })),
          ...(node.props.defaultIndex === undefined
            ? {}
            : { defaultIndex: node.props.defaultIndex }),
          ...(node.props.variant ? { variant: node.props.variant } : {}),
        },
      };
    case "key-value":
      return {
        kind: node.kind,
        props: {
          ...(node.props.title ? { title: node.props.title } : {}),
          ...(node.props.source ? { source: resource(node.props.source) } : {}),
          ...(node.props.data ? { data: { ...node.props.data } } : {}),
        },
      };
    case "query-editor":
      return {
        kind: node.kind,
        props: {
          language: node.props.language,
          ...(node.props.value !== undefined
            ? { value: node.props.value }
            : {}),
          action: action(node.props.action),
          ...(node.props.explorer
            ? {
                explorer: explorer(node.props.explorer),
              }
            : {}),
        },
      };
    case "resource-tree":
      return {
        kind: node.kind,
        props: {
          label: node.props.label,
          branch: treeBranch(node.props.branch),
          ...(node.props.selectedPath
            ? { selectedPath: node.props.selectedPath }
            : {}),
          ...(node.props.stateKey ? { stateKey: node.props.stateKey } : {}),
          ...(node.props.searchPlaceholder
            ? { searchPlaceholder: node.props.searchPlaceholder }
            : {}),
        },
      };
    case "resource": {
      const props = node.props as ResourceProps;
      return {
        kind: node.kind,
        props: {
          ...(props.source ? { source: resource(props.source) } : {}),
          content: nodes(props.content),
        },
      };
    }
    case "link":
      return { kind: node.kind, props: { ...node.props } };
    case "code-block":
      return { kind: node.kind, props: { ...node.props } };
    case "notebook":
      return {
        kind: node.kind,
        props: {
          ...(node.props.id ? { id: node.props.id } : {}),
          title: node.props.title,
          ...(node.props.description
            ? { description: node.props.description }
            : {}),
          ...(node.props.notebooks
            ? {
                notebooks: node.props.notebooks.map(
                  (item: { id: string; title: string }) => ({ ...item }),
                ),
              }
            : {}),
          ...(node.props.openTabs
            ? {
                openTabs: node.props.openTabs.map(
                  (item: { id: string; title: string }) => ({ ...item }),
                ),
              }
            : {}),
          ...(node.props.metadata
            ? { metadata: { ...node.props.metadata } }
            : {}),
          ...(node.props.actions
            ? {
                actions: {
                  ...(node.props.actions.save
                    ? { save: action(node.props.actions.save) }
                    : {}),
                  ...(node.props.actions.select
                    ? { select: action(node.props.actions.select) }
                    : {}),
                  ...(node.props.actions.create
                    ? { create: action(node.props.actions.create) }
                    : {}),
                  ...(node.props.actions.delete
                    ? { delete: action(node.props.actions.delete) }
                    : {}),
                  ...(node.props.actions.duplicate
                    ? { duplicate: action(node.props.actions.duplicate) }
                    : {}),
                  ...(node.props.actions.import
                    ? { import: action(node.props.actions.import) }
                    : {}),
                  ...(node.props.actions.close
                    ? { close: action(node.props.actions.close) }
                    : {}),
                },
              }
            : {}),
          blocks: node.props.blocks.map((block: NotebookBlock) =>
            block.kind === "code"
              ? {
                  ...block,
                  action: action(block.action),
                }
              : { ...block },
          ),
        },
      };
    case "notebook-catalog":
      return {
        kind: node.kind,
        props: {
          notebooks: node.props.notebooks.map(
            (item: {
              id: string;
              title: string;
              description?: string;
              environment?: string;
              location?: string;
              updatedAt?: string;
              lastViewedAt?: string;
            }) => ({ ...item }),
          ),
          ...(node.props.actions
            ? {
                actions: {
                  ...(node.props.actions.create
                    ? { create: action(node.props.actions.create) }
                    : {}),
                  ...(node.props.actions.import
                    ? { import: action(node.props.actions.import) }
                    : {}),
                },
              }
            : {}),
        },
      };
    case "split-pane":
      return {
        kind: node.kind,
        props: {
          sidebar: nodes(node.props.sidebar),
          content: nodes(node.props.content),
          ...(node.props.inspector
            ? { inspector: nodes(node.props.inspector) }
            : {}),
        },
      };
    case "select":
      if (node.props.onChange)
        throw new UnserializablePageError(
          "Select callbacks cannot be serialized",
        );
      return {
        kind: node.kind,
        props: {
          name: node.props.name,
          ...(node.props.label ? { label: node.props.label } : {}),
          options: node.props.options,
          ...(node.props.value !== undefined
            ? { value: node.props.value }
            : {}),
          ...(node.props.placeholder
            ? { placeholder: node.props.placeholder }
            : {}),
        },
      };
    case "text-input":
      if (node.props.onChange)
        throw new UnserializablePageError(
          "Text input callbacks cannot be serialized",
        );
      return {
        kind: node.kind,
        props: {
          name: node.props.name,
          ...(node.props.label ? { label: node.props.label } : {}),
          ...(node.props.value !== undefined
            ? { value: node.props.value }
            : {}),
          ...(node.props.placeholder
            ? { placeholder: node.props.placeholder }
            : {}),
          ...(node.props.secret ? { secret: true } : {}),
        },
      };
    case "form":
      return {
        kind: node.kind,
        props: {
          fields: nodes(node.props.fields ?? []),
          action: action(node.props.onSubmit),
          ...(node.props.submitLabel
            ? { submitLabel: node.props.submitLabel }
            : {}),
        },
      };
    case "code-editor":
      throw new UnserializablePageError(
        "Code editor nodes require a browser-state protocol",
      );
    case "custom":
      return {
        kind: node.kind,
        props: {
          component: node.props.component,
          path: node.props.path,
          ...(node.props.browserUrl
            ? { browserUrl: node.props.browserUrl }
            : {}),
          ...(node.props.props ? { props: { ...node.props.props } } : {}),
        },
      };
    case "section":
      return {
        kind: node.kind,
        props: {
          title: node.props.title,
          ...(node.props.description
            ? { description: node.props.description }
            : {}),
          ...(node.props.link ? { link: { ...node.props.link } } : {}),
          content: nodes(node.props.content),
        },
      };
    case "card": {
      const props = node.props as CardProps;
      return {
        kind: node.kind,
        props: {
          ...(props.title ? { title: props.title } : {}),
          ...(props.description ? { description: props.description } : {}),
          ...(props.icon ? { icon: props.icon } : {}),
          ...(props.badge ? { badge: props.badge } : {}),
          ...(props.badgeTone ? { badgeTone: props.badgeTone } : {}),
          ...(props.link ? { link: { ...props.link } } : {}),
          ...(props.variant ? { variant: props.variant } : {}),
          ...(props.content ? { content: nodes(props.content) } : {}),
        },
      };
    }
    case "collection": {
      const props = node.props as CollectionProps;
      return {
        kind: node.kind,
        props: {
          ...(props.source ? { source: resource(props.source) } : {}),
          ...(props.field ? { field: props.field } : {}),
          content: nodes(props.content),
        },
      };
    }
    case "flex": {
      const props = node.props as FlexProps;
      return {
        kind: node.kind,
        props: {
          direction: props.direction,
          ...(props.gap ? { gap: props.gap } : {}),
          ...(props.align ? { align: props.align } : {}),
          ...(props.justify ? { justify: props.justify } : {}),
          ...(props.wrap ? { wrap: true } : {}),
          content: nodes(props.content),
        },
      };
    }
    case "columns":
      return {
        kind: node.kind,
        props: {
          columns: node.props.columns.map((column: ColumnsColumn) => ({
            ...(column.weight !== undefined ? { weight: column.weight } : {}),
            content: nodes(column.content),
          })),
        },
      };
    case "grid": {
      const props = node.props as GridProps;
      return {
        kind: node.kind,
        props: {
          ...(props.columns !== undefined ? { columns: props.columns } : {}),
          ...(props.gap ? { gap: props.gap } : {}),
          content: nodes(props.content),
        },
      };
    }
    case "stack": {
      const props = node.props as StackProps;
      return {
        kind: node.kind,
        props: {
          ...(props.gap ? { gap: props.gap } : {}),
          content: nodes(props.content),
        },
      };
    }
    case "value": {
      const props = node.props as ValueProps;
      return {
        kind: node.kind,
        props: {
          ...(props.source ? { source: resource(props.source) } : {}),
          field: props.field,
          ...(props.format ? { format: props.format } : {}),
          ...(props.fallback ? { fallback: props.fallback } : {}),
        },
      };
    }
    case "meter":
      return {
        kind: node.kind,
        props: {
          ...(node.props.source ? { source: resource(node.props.source) } : {}),
          ...(node.props.format ? { format: node.props.format } : {}),
          ...(node.props.data
            ? {
                data: {
                  segments: node.props.data.segments.map(
                    (segment: MeterSegment) => ({
                      ...segment,
                    }),
                  ),
                  ...(node.props.data.format
                    ? { format: node.props.data.format }
                    : {}),
                  ...(node.props.data.footer
                    ? { footer: node.props.data.footer }
                    : {}),
                },
              }
            : {}),
        },
      };
    default:
      throw new UnserializablePageError(
        `Unsupported component kind: ${node.kind}`,
      );
  }
}

export function serializeNodes(
  value: PageNode | readonly PageNode[],
): readonly PageNode[] {
  return nodes(value);
}
