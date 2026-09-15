import type { BadgeProps } from "../primitives/badge";
import { type ComponentProps, componentProps } from "../runtime";

export function Badge({ node, context }: ComponentProps) {
  const props = componentProps<BadgeProps>(node);
  if (!props) return null;
  const label = resolve(props.label, context);
  if (!label) return null;
  return (
    <span
      className={props.dot ? "table-cell-status" : "table-cell-badge"}
      data-tone={resolve(props.tone, context) ?? "muted"}
    >
      {props.dot ? <i aria-hidden="true" /> : null}
      {label}
    </span>
  );
}

export default Badge;

function resolve(
  value: unknown,
  context: Record<string, unknown> | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || !("field" in value))
    return undefined;
  const result = String(value.field)
    .split(".")
    .reduce<unknown>((current, key) => {
      if (current && typeof current === "object")
        return (current as Record<string, unknown>)[key];
      return undefined;
    }, context);
  return result === undefined || result === null ? undefined : String(result);
}
