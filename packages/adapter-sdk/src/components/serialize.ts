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
  target: ActionTarget | { readonly kind: "action"; readonly id: string },
): ActionReference {
  return target.kind === "action-binding"
    ? { actionId: target.actionId, input: target.input }
    : { actionId: target.id };
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
      if (node.props.actions || node.props.onRowClick)
        throw new UnserializablePageError(
          "Table callbacks cannot be serialized",
        );
      return {
        kind: node.kind,
        props: {
          ...(node.props.source ? { source: resource(node.props.source) } : {}),
          ...(node.props.data ? { data: node.props.data } : {}),
          ...(node.props.columns ? { columns: node.props.columns } : {}),
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
