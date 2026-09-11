import type { RegistryViewProps } from "../registry/view-registry";
import { WorkbenchIcon } from "./icons";

export function IconView({ node, context }: RegistryViewProps) {
  if (node.kind !== "icon") return null;
  const name = resolve(node.props.name, context);
  if (!name) return null;
  return (
    <span className="table-cell-icon">
      {/^https?:\/\//i.test(name) ? (
        <img
          src={name}
          alt=""
          width={node.props.size ?? 16}
          height={node.props.size ?? 16}
        />
      ) : (
        <WorkbenchIcon name={name} size={node.props.size ?? 16} />
      )}
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
