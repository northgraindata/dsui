import type { z } from "zod";
import type { PageNode } from "./nodes";

/** Props for a browser component reference. */
export interface ComponentReferenceProps {
  /** Registry id, e.g. `"duckdb/table-card"`. */
  component: string;
  /** JSON-serializable props for the component. */
  props?: Record<string, unknown>;
}

/** A browser component reference node. */
export interface ComponentReferenceNode {
  readonly kind: "custom";
  readonly props: ComponentReferenceProps;
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
      props: { component: options.id, props: parsed },
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
