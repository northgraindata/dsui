import type { RegistryViewProps } from "../registry/view-registry";
import { WorkbenchIcon } from "./icons";

export function LinkView({ node, context, client }: RegistryViewProps) {
  if (node.kind !== "link") return null;
  const href = resolve(node.props.href, context);
  const label = resolve(node.props.label, context);
  if (!href || !label) return null;
  const external = node.props.external ?? /^https?:\/\//i.test(href);
  return external ? (
    <a href={href} target="_blank" rel="noreferrer">
      {node.props.icon ? <WorkbenchIcon name={resolve(node.props.icon, context) ?? "file"} size={16} /> : null}
      {label}
    </a>
  ) : (
    <button type="button" onClick={() => client.navigate(href)}>
      {label}
    </button>
  );
}

function resolve(value: unknown, context: Record<string, unknown> | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || !("field" in value)) return undefined;
  const result = String(value.field).split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object") return (current as Record<string, unknown>)[key];
    return undefined;
  }, context);
  return result === undefined || result === null ? undefined : String(result);
}
