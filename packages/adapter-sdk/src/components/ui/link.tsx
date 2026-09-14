import type { LinkProps } from "../primitives/link";
import { type ComponentProps, componentProps } from "../runtime";

export function Link({ client, node, context }: ComponentProps) {
  const props = componentProps<LinkProps>(node);
  if (!props) return null;
  const href = resolve(props.href, context);
  const label = resolve(props.label, context);
  if (!href || !label) return null;
  if (props.external || /^https?:\/\//i.test(href))
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  return (
    <button type="button" onClick={() => client.navigate(href)}>
      {label}
    </button>
  );
}

export default Link;

function resolve(
  value: unknown,
  context: Record<string, unknown> | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || !("field" in value))
    return undefined;
  const result = String(value.field)
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[key]
          : undefined,
      context,
    );
  return result === undefined || result === null ? undefined : String(result);
}
