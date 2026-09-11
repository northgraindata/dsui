import type { RegistryViewProps } from "../registry/view-registry";

export function BadgeView({ node, context }: RegistryViewProps) {
  if (node.kind !== "badge") return null;
  const label = resolve(node.props.label, context);
  if (!label) return null;
  const tone = resolve(node.props.tone, context) ?? "muted";
  return (
    <span
      className={node.props.dot ? "table-cell-status" : "table-cell-badge"}
      data-tone={tone}
    >
      {node.props.dot ? <i aria-hidden="true" /> : null}
      {label}
    </span>
  );
}

function resolve(
  value: unknown,
  context: Record<string, unknown> | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || !("field" in value)) return undefined;
  const resolved = String(value.field).split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object") return (current as Record<string, unknown>)[key];
    return undefined;
  }, context);
  return resolved === undefined || resolved === null ? undefined : String(resolved);
}
