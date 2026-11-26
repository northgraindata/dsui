/**
 * Converts live SDK page nodes into the browser-safe page protocol.
 *
 * One walker handles every node: it turns bindings into references and copies
 * plain data. Only nodes whose protocol differs from their authoring props have
 * a normalizer below, so a new prop needs no serialization code.
 */
import type { PageNode } from "./nodes";

/** Thrown when a live SDK node cannot cross the server/browser boundary. */
export class UnserializablePageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnserializablePageError";
  }
}

type Props = Record<string, unknown>;

/** Kinds the protocol carries. Anything else is a mistake in the page. */
const SERIALIZABLE_KINDS: ReadonlySet<string> = new Set(
  (
    "badge button card code-block collection columns custom flex form gauge " +
    "grid icon key-value link meter notebook notebook-catalog page-header " +
    "query-editor resource resource-tree section select split-pane stack " +
    "table tabs text-input value"
  ).split(" "),
);

function isRecord(value: unknown): value is Props {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** An action may be a definition, a binding, its id, or a context field. */
function actionReference(target: unknown): unknown {
  if (typeof target === "string") return { actionId: target };
  const record = target as Props;
  if ("field" in record) return value(record);
  return record.kind === "action-binding"
    ? value(record)
    : { actionId: record.id };
}

function mapDefined(
  record: unknown,
  convert: (item: unknown) => unknown,
): unknown {
  if (!isRecord(record)) return record;
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, convert(item)]),
  );
}

/** Table actions declare `action` and `input` apart; the protocol joins them. */
function tableAction(spec: unknown): unknown {
  const { action, input, ...rest } = spec as Props;
  if (!action) return rest;
  const actionId = typeof action === "string" ? action : (action as Props).id;
  return { ...rest, action: { actionId, ...(input ? { input } : {}) } };
}

function rejectCallback(props: Props, name: string): Props {
  if (props.onChange)
    throw new UnserializablePageError(`${name} callbacks cannot be serialized`);
  return props;
}

const NORMALIZERS: Readonly<Record<string, (props: Props) => Props>> = {
  button: (props) =>
    props.action ? { ...props, action: actionReference(props.action) } : props,
  "query-editor": (props) => ({
    ...props,
    action: actionReference(props.action),
  }),
  // `schema` validates on the server and is not part of the protocol.
  form: (props) => ({
    fields: props.fields ?? [],
    action: actionReference(props.onSubmit),
    ...(props.submitLabel ? { submitLabel: props.submitLabel } : {}),
  }),
  table: (props) => ({
    ...props,
    ...(Array.isArray(props.rowActions)
      ? { rowActions: props.rowActions.map(tableAction) }
      : {}),
    ...(Array.isArray(props.actions)
      ? { actions: props.actions.map(tableAction) }
      : {}),
  }),
  notebook: (props) => ({
    ...props,
    ...(props.actions
      ? { actions: mapDefined(props.actions, actionReference) }
      : {}),
    blocks: (props.blocks as Props[]).map((block) =>
      block.kind === "code"
        ? { ...block, action: actionReference(block.action) }
        : block,
    ),
  }),
  "notebook-catalog": (props) =>
    props.actions
      ? { ...props, actions: mapDefined(props.actions, actionReference) }
      : props,
  select: (props) => rejectCallback(props, "Select"),
  "text-input": (props) => rejectCallback(props, "Text input"),
};

/** Props that hold nested page nodes, which need their own normalizers. */
const CHILD_PROPS: ReadonlySet<string> = new Set([
  "actions",
  "content",
  "fields",
  "inspector",
  "renderCell",
  "sidebar",
  "tags",
]);

function isPageNode(candidate: unknown): candidate is PageNode {
  return (
    isRecord(candidate) &&
    typeof candidate.kind === "string" &&
    isRecord(candidate.props)
  );
}

/** Converts any authoring value into JSON-safe protocol data. */
function value(input: unknown, key?: string): unknown {
  if (Array.isArray(input))
    return input.map((item) =>
      key && CHILD_PROPS.has(key) && isPageNode(item)
        ? serializeNode(item)
        : value(item, key),
    );
  // The protocol always carries children as a list, even a single one.
  if (key && CHILD_PROPS.has(key) && isPageNode(input))
    return [serializeNode(input)];
  if (typeof input === "function") {
    const definition = input as unknown as Props;
    if (definition.kind === "action") return { actionId: definition.id };
    throw new UnserializablePageError(
      `Functions cannot be serialized${key ? ` (prop "${key}")` : ""}`,
    );
  }
  if (!isRecord(input)) return input;
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null)
    throw new UnserializablePageError(
      `Only plain objects can be serialized${key ? ` (prop "${key}")` : ""}`,
    );
  if (input.kind === "resource-binding")
    return pick(input, ["resourceId", "input", "refresh"]);
  if (input.kind === "action-binding")
    return pick(input, ["actionId", "input"]);
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, item]) => item !== undefined)
      .map(([name, item]) => [name, value(item, name)]),
  );
}

function pick(record: Props, keys: readonly string[]): Props {
  return Object.fromEntries(
    keys
      .filter((key) => record[key] !== undefined)
      .map((key) => [key, record[key]]),
  );
}

/** Converts static SDK page nodes into the browser-safe page protocol. */
export function serializeNode(node: PageNode): PageNode {
  if (node.kind === "code-editor")
    throw new UnserializablePageError(
      "Code editor nodes require a browser-state protocol",
    );
  if (!SERIALIZABLE_KINDS.has(node.kind))
    throw new UnserializablePageError(
      `Unsupported component kind: ${node.kind}`,
    );
  // `defineComponent` already made a browser reference's props JSON-safe.
  if (node.kind === "custom")
    return { kind: node.kind, props: { ...(node.props as Props) } };
  const props = node.props as Props;
  const normalized = NORMALIZERS[node.kind]?.(props) ?? props;
  return { kind: node.kind, props: value(normalized) as Props };
}

export function serializeNodes(
  nodes: PageNode | readonly PageNode[],
): readonly PageNode[] {
  return (Array.isArray(nodes) ? nodes : [nodes]).map(serializeNode);
}
