import type { z } from "zod";
import type { PageNode } from "./nodes";

/** Props for a browser component reference. */
export interface ComponentReferenceProps {
  /** Stable component id, e.g. `"duckdb/table-card"`. */
  component: string;
  /** Browser module path declared by the component definition. */
  path: string;
  /** Filled by the host when the component comes from an external adapter. */
  browserUrl?: string;
  /** JSON-serializable props for the component. */
  props?: Record<string, unknown>;
}

/** A browser component reference node. */
export interface ComponentReferenceNode {
  readonly kind: "custom";
  readonly props: ComponentReferenceProps;
}

function browserProps(value: unknown): unknown {
  if (typeof value === "function") {
    const action = value as unknown as { kind?: unknown; id?: unknown };
    return action.kind === "action" && typeof action.id === "string"
      ? { actionId: action.id }
      : undefined;
  }
  if (Array.isArray(value)) return value.map(browserProps);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (record.kind === "action-binding" && typeof record.actionId === "string")
    return {
      actionId: record.actionId,
      ...("input" in record ? { input: browserProps(record.input) } : {}),
    };
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, browserProps(item)]),
  );
}

/**
 * Defines a named component in exactly one of two modes.
 *
 * - `render`: a composite of builtin components, evaluated on the server.
 * - `path`: a browser component reference loaded by the host.
 *
 * The same definition mechanism is used by standard components and adapters.
 */
export function defineComponent<
  TProps extends object = Record<string, unknown>,
  TReturn extends
    | PageNode
    | readonly PageNode[]
    | ComponentReferenceNode = ComponentReferenceNode,
>(options: {
  id: string;
  render?: (props: TProps) => TReturn;
  path?: string;
  props?: z.ZodTypeAny;
}): ((props?: TProps) => TReturn) & {
  readonly kind: "component";
  readonly id: string;
} {
  if (!options.id) throw new Error("Component id must be a non-empty string");
  if (!options.render && !options.path)
    throw new Error("Component requires either render or path");
  if (options.render && options.path)
    throw new Error("Component accepts either render or path, not both");
  if (options.path !== undefined && !options.path)
    throw new Error("Component path must be a non-empty string");
  const callable = (props?: TProps) => {
    if (!options.path) {
      return (options.render as (props?: TProps) => unknown)(props);
    }
    const input = (props ?? {}) as Record<string, unknown>;
    const parsed = options.props
      ? (options.props.parse(input) as Record<string, unknown>)
      : input;
    return {
      kind: "custom",
      props: {
        component: options.id,
        path: options.path,
        props: browserProps(parsed) as Record<string, unknown>,
      },
    } satisfies ComponentReferenceNode;
  };
  return Object.assign(callable, {
    kind: "component" as const,
    id: options.id,
  }) as ((props?: TProps) => TReturn) & {
    readonly kind: "component";
    readonly id: string;
  };
}
