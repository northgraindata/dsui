import type { ComponentNode } from "./nodes";

/**
 * Defines a named composite of builtin components.
 *
 * Custom components are NOT required for standard adapters and never
 * carry browser code. They are node factories evaluated wherever pages
 * render. Use them to name and reuse adapter-specific composites (e.g. a
 * session bar) without bypassing DSUI rendering.
 *
 * @param options.id - Unique component name, e.g. `"session-bar"`.
 * @param options.render - Builds builtin nodes from props.
 * @returns A callable returning builtin nodes, tagged with kind and id.
 * @throws An error when the id is empty.
 *
 * @example
 * ```ts
 * export const SessionBar = defineComponent<SessionProps, readonly ComponentNode[]>({
 *   id: "session-bar",
 *   render: (props) => [
 *     Select({ name: "role", options: props.roles, value: props.role }),
 *   ],
 * });
 * ```
 */
export function defineComponent<
  TProps extends object,
  TReturn extends ComponentNode | readonly ComponentNode[] =
    | ComponentNode
    | readonly ComponentNode[],
>(options: {
  id: string;
  render: (props: TProps) => TReturn;
}): ((props: TProps) => TReturn) & {
  readonly kind: "component";
  readonly id: string;
} {
  if (!options.id) throw new Error("Component id must be a non-empty string");
  const callable = (props: TProps) => options.render(props);
  return Object.assign(callable, {
    kind: "component" as const,
    id: options.id,
  });
}
