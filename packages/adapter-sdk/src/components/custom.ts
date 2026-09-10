import type { z } from "zod";
import type { ComponentNode, CustomNode } from "./nodes";

/**
 * Defines a named component in exactly one of two modes.
 *
 * - `render`: a composite of builtin components, evaluated on the server.
 *   Use it to name and reuse adapter-specific composites (e.g. a session
 *   bar) without bypassing DSUI rendering.
 * - `path`: a browser component reference. The tsx module (relative to
 *   the adapter package) is lazy-loaded by `id`; no browser code crosses
 *   the server boundary, only the id and JSON-serializable props.
 *
 * The same definition mechanism is used internally by DSUI's standard
 * components and is available to adapters for composites and browser views.
 * Standard adapters should import the shared component factories rather than
 * define duplicate versions of them.
 *
 * @param options.id - Unique component name, e.g. `"session-bar"` or `"duckdb/table-card"`.
 * @param options.render - Builds builtin nodes from props (render mode).
 * @param options.path - tsx module resolved by the host build (path mode).
 * @param options.props - Optional Zod schema validating path-mode props at authoring time.
 * @returns A callable returning nodes, tagged with kind and id.
 * @throws An error when the id is empty, neither or both modes are set,
 * the path is empty, or props fail validation.
 *
 * @example
 * ```ts
 * export const SessionBar = defineComponent<SessionProps, readonly ComponentNode[]>({
 *   id: "session-bar",
 *   render: (props) => [
 *     Select({ name: "role", options: props.roles, value: props.role }),
 *   ],
 * });
 * export const TableCard = defineComponent<{ table: string }>({
 *   id: "duckdb/table-card",
 *   path: "./components/TableCard.tsx",
 * });
 * ```
 */
export function defineComponent<
  TProps extends object = Record<string, unknown>,
  TReturn extends
    | ComponentNode
    | readonly ComponentNode[]
    | CustomNode = CustomNode,
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
    } satisfies CustomNode;
  };
  // The implementation is deliberately loose; the public signature above
  // carries the precise types for both modes.
  return Object.assign(callable, {
    kind: "component" as const,
    id: options.id,
  }) as ((props?: TProps) => TReturn) & {
    readonly kind: "component";
    readonly id: string;
  };
}
