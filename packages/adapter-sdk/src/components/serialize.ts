import type {
  ActionReference,
  PageNode,
  ResourceReference,
} from "@northgraindata/dsui-core";
import type { ActionTarget } from "../action/index";
import type { DataSource } from "../resource/index";
import type { ComponentNode } from "./nodes";

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
  };
}

function action(
  target:
    | ActionTarget
    | { readonly kind: "action"; readonly id: string }
    | string,
): ActionReference {
  if (typeof target === "string") return { actionId: target };
  return target.kind === "action-binding"
    ? { actionId: target.actionId, input: target.input }
    : { actionId: target.id };
}

function explorer(
  value: NonNullable<import("./nodes").QueryWorkbenchProps["explorer"]>,
): NonNullable<
  Extract<PageNode, { kind: "query-workbench" }>["props"]["explorer"]
> {
  return {
    source: resource(value.source),
    ...(value.nameField ? { nameField: value.nameField } : {}),
    ...(value.children ? { children: explorer(value.children) } : {}),
  };
}

function treeBranch(
  value: import("./nodes").ResourceTreeBranchProps,
): import("@northgraindata/dsui-core").ResourceTreeBranchDocument {
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

function nodes(
  value: ComponentNode | readonly ComponentNode[],
): readonly PageNode[] {
  return (Array.isArray(value) ? value : [value]).map(serializeNode);
}

/** Converts static SDK page nodes into the browser-safe page protocol. */
export function serializeNode(node: ComponentNode): PageNode {
  switch (node.kind) {
    case "page-header":
      if (node.props.actions?.length)
        throw new UnserializablePageError(
          "Page header actions are not supported yet",
        );
      return {
        kind: node.kind,
        props: {
          title: node.props.title,
          ...(node.props.description
            ? { description: node.props.description }
            : {}),
        },
      };
    case "table":
      return {
        kind: node.kind,
        props: {
          ...(node.props.source ? { source: resource(node.props.source) } : {}),
          ...(node.props.data ? { data: node.props.data } : {}),
          ...(node.props.columns ? { columns: node.props.columns } : {}),
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
                rowActions: node.props.rowActions.map((rowAction) => ({
                  label: rowAction.label,
                  ...(rowAction.variant ? { variant: rowAction.variant } : {}),
                  action: {
                    actionId:
                      typeof rowAction.action === "string"
                        ? rowAction.action
                        : rowAction.action.id,
                    ...(rowAction.input
                      ? { input: { ...rowAction.input } }
                      : {}),
                  },
                  ...(rowAction.when ? { when: { ...rowAction.when } } : {}),
                })),
              }
            : {}),
        },
      };
    case "dependency-graph":
      return {
        kind: node.kind,
        props: {
          ...(node.props.source ? { source: resource(node.props.source) } : {}),
          ...(node.props.data ? { data: node.props.data } : {}),
          idField: node.props.idField,
          dependsOnField: node.props.dependsOnField,
          ...(node.props.labelField
            ? { labelField: node.props.labelField }
            : {}),
          ...(node.props.detailField
            ? { detailField: node.props.detailField }
            : {}),
          ...(node.props.rowLink
            ? {
                rowLink: {
                  path: node.props.rowLink.path,
                  params: { ...node.props.rowLink.params },
                },
              }
            : {}),
        },
      };
    case "button":
      return {
        kind: node.kind,
        props: {
          label: node.props.label,
          ...(node.props.variant ? { variant: node.props.variant } : {}),
          ...(node.props.action ? { action: action(node.props.action) } : {}),
        },
      };
    case "tabs":
      return {
        kind: node.kind,
        props: {
          items: node.props.items.map((item) => ({
            label: item.label,
            content: nodes(item.content),
          })),
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
    case "query-workbench":
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
  }
}

export function serializeNodes(
  value: ComponentNode | readonly ComponentNode[],
): readonly PageNode[] {
  return nodes(value);
}
