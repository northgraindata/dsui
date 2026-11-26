import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import { resolveLink } from "@northgraindata/dsui-adapter-sdk/components/ui/table";
import type { ComponentProps as RegistryViewProps } from "../../runtime";
import { WorkbenchIcon } from "../icons";
import { keyedItems } from "../keyed-items";

function nodes(value: PageNode | readonly PageNode[]): readonly PageNode[] {
  return "kind" in value ? [value] : value;
}

export function Card({ client, node, renderNode, context }: RegistryViewProps) {
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
      <section
        className="dsui-card"
        data-variant="metric"
        data-icon={icon ?? undefined}
      >
        {icon ? (
          <span className="dsui-card-icon">
            <WorkbenchIcon name={icon} size={20} />
          </span>
        ) : null}
        <div className="dsui-card-metric">
          <strong className="dsui-card-value">
            {keyedItems(content).map(({ item: child, key }) => (
              <span key={key}>{renderNode(client, child, context)}</span>
            ))}
          </strong>
          {title ? <small className="dsui-card-label">{title}</small> : null}
        </div>
      </section>
    );
  }
  if (node.props.variant === "interactive") {
    return (
      <article className="dsui-card" data-variant="interactive">
        <div className="dsui-card-interactive-heading">
          {icon && (
            <span className="dsui-card-icon">
              <WorkbenchIcon name={icon} size={20} />
            </span>
          )}
          <div className="dsui-card-interactive-body">
            {title &&
              (href ? (
                <button
                  type="button"
                  className="dsui-card-title"
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
            <span className="dsui-card-badge dsui-badge" data-tone={badgeTone}>
              {badge}
            </span>
          )}
        </div>
        {content.length > 0 && (
          <div className="dsui-card-content">
            {keyedItems(content).map(({ item: child, key }) => (
              <div key={key}>{renderNode(client, child, context)}</div>
            ))}
          </div>
        )}
        {href && (
          <span className="dsui-card-chevron" aria-hidden="true">
            <WorkbenchIcon name="chevron" size={14} />
          </span>
        )}
      </article>
    );
  }
  return (
    <section
      className="dsui-card"
      data-variant={node.props.variant ?? "default"}
    >
      {icon && (
        <span className="dsui-card-icon">
          <WorkbenchIcon name={icon} size={20} />
        </span>
      )}
      {(title || description || badge) && (
        <header className="dsui-card-header">
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
            <span className="dsui-card-badge" data-tone={badgeTone}>
              {badge}
            </span>
          )}
        </header>
      )}
      <div className="dsui-card-content">
        {keyedItems(content).map(({ item: child, key }) => (
          <div key={key}>{renderNode(client, child, context)}</div>
        ))}
      </div>
    </section>
  );
}

export default Card;

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
