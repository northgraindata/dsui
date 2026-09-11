import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { RegistryViewProps } from "../../registry/view-registry";
import { WorkbenchIcon } from "../icons";
import { resolveLink } from "../table";

function nodes(value: PageNode | readonly PageNode[]): readonly PageNode[] {
  return "kind" in value ? [value] : value;
}

export function CardView({
  client,
  node,
  renderNode,
  context,
}: RegistryViewProps) {
  if (node.kind !== "card") return null;
  const title = field(node.props.title, context);
  const description = field(node.props.description, context);
  const icon = field(node.props.icon, context);
  const badge = field(node.props.badge, context);
  const badgeTone = field(node.props.badgeTone, context) ?? "info";
  const href =
    node.props.link && context
      ? resolveLink(node.props.link.path, node.props.link.params, context)
      : null;
  const content = node.props.content ? nodes(node.props.content) : [];
  if (node.props.variant === "metric") {
    return (
      <section className="layout-card" data-variant="metric">
        {icon ? (
          <span className="layout-card-icon">
            <WorkbenchIcon name={icon} size={20} />
          </span>
        ) : null}
        <div className="layout-card-metric">
          <strong className="layout-card-value">
            {content.map((child, index) => (
              <span key={`${child.kind}-${index}`}>
                {renderNode(client, child, context)}
              </span>
            ))}
          </strong>
          {title ? <small className="layout-card-label">{title}</small> : null}
        </div>
      </section>
    );
  }
  if (node.props.variant === "interactive") {
    return (
      <article className="layout-card" data-variant="interactive">
        <div className="layout-card-interactive-heading">
          {icon && (
            <span className="layout-card-icon">
              <WorkbenchIcon name={icon} size={20} />
            </span>
          )}
          <div className="layout-card-interactive-body">
            {title &&
              (href ? (
                <button
                  type="button"
                  className="layout-card-title"
                  onClick={() => client.navigate(href)}
                >
                  {title}
                </button>
              ) : (
                <h3>{title}</h3>
              ))}
            {description && <p>{description}</p>}
          </div>
          {badge && (
            <span className="layout-card-badge ov-badge" data-tone={badgeTone}>
              {badge}
            </span>
          )}
        </div>
        {content.length > 0 && (
          <div className="layout-card-content">
            {content.map((child, index) => (
              <div key={`${child.kind}-${index}`}>
                {renderNode(client, child, context)}
              </div>
            ))}
          </div>
        )}
        {href && (
          <span className="layout-card-chevron" aria-hidden="true">
            <WorkbenchIcon name="chevron" size={14} />
          </span>
        )}
      </article>
    );
  }
  return (
    <section
      className="layout-card"
      data-variant={node.props.variant ?? "default"}
    >
      {icon && (
        <span className="layout-card-icon">
          <WorkbenchIcon name={icon} size={20} />
        </span>
      )}
      {(title || description || badge) && (
        <header className="layout-card-header">
          {title &&
            (href ? (
              <button type="button" onClick={() => client.navigate(href)}>
                {title}
              </button>
            ) : (
              <h3>{title}</h3>
            ))}
          {description && <p>{description}</p>}
          {badge && (
            <span className="layout-card-badge" data-tone={badgeTone}>
              {badge}
            </span>
          )}
        </header>
      )}
      <div className="layout-card-content">
        {content.map((child, index) => (
          <div key={`${child.kind}-${index}`}>
            {renderNode(client, child, context)}
          </div>
        ))}
      </div>
    </section>
  );
}

function field(
  value: unknown,
  context: Record<string, unknown> | undefined,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object" && "field" in value) {
    const fieldName = value.field;
    if (typeof fieldName !== "string") return undefined;
    const resolved = context?.[fieldName];
    return resolved === undefined || resolved === null
      ? undefined
      : String(resolved);
  }
  return String(value);
}
