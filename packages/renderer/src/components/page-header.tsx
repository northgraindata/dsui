import type { RegistryViewProps } from "../registry/view-registry";
import { WorkbenchIcon } from "./icons";

/** Page header: title with optional description. */
export function PageHeaderView({ client, node, renderNode, context }: RegistryViewProps) {
  if (node.kind !== "page-header") return null;
  const title = resolve(node.props.title, context);
  const description = resolve(node.props.description, context);
  const icon = resolve(node.props.icon, context);
  const badge = node.props.badge
    ? {
        label: resolve(node.props.badge.label, context),
        tone: resolve(node.props.badge.tone, context),
      }
    : undefined;
  return (
    <header className="page-header" data-variant={node.props.variant ?? "default"}>
      <div className="page-header-main">
        {icon ? <WorkbenchIcon name={icon} size={28} /> : null}
        <div className="page-header-copy">
        <h1 className="m-0 text-[17px] font-semibold text-primary">
          {title}
        </h1>
        {description ? (
        <p className="mt-1 text-[12px] text-secondary">
          {description}
        </p>
        ) : null}
          {node.props.tags ? (
            <div className="page-header-tags">
              {nodes(node.props.tags).map((child, index) => (
                <span key={`${child.kind}-${index}`}>{renderNode(client, child, context)}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {badge?.label ? <span data-tone={badge.tone ?? "info"}>{badge.label}</span> : null}
      {node.props.actions ? (
        <div className="page-header-actions">
          {nodes(node.props.actions).map((child, index) => (
            <span key={`${child.kind}-${index}`}>{renderNode(client, child, context)}</span>
          ))}
        </div>
      ) : null}
    </header>
  );
}

function nodes(value: import("@northgraindata/dsui-adapter-sdk").PageNode | readonly import("@northgraindata/dsui-adapter-sdk").PageNode[]) {
  return "kind" in value ? [value] : value;
}

function resolve(value: unknown, context: Record<string, unknown> | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || !("field" in value)) return undefined;
  const resolved = String(value.field).split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object") return (current as Record<string, unknown>)[key];
    return undefined;
  }, context);
  return resolved === undefined || resolved === null ? undefined : String(resolved);
}
