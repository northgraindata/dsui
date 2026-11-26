import { Fragment } from "react";
import type { ComponentProps as RegistryViewProps } from "../../runtime";
import { positioned } from "../keys";
import { asNodes } from "./layout-items";

export function Section({
  client,
  node,
  renderNode,
  context,
}: RegistryViewProps) {
  if (node.kind !== "section") return null;
  const link = node.props.link;
  return (
    <section className="dsui-section">
      <header className="dsui-section-header">
        <div>
          <h2>{node.props.title}</h2>
          {node.props.description ? <p>{node.props.description}</p> : null}
        </div>
        {link ? (
          <button
            type="button"
            className="dsui-section-link"
            onClick={() => client.navigate(link.path)}
          >
            {link.label}
            <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </header>
      {positioned(asNodes(node.props.content)).map(({ item, key }) => (
        <Fragment key={key}>{renderNode(client, item, context)}</Fragment>
      ))}
    </section>
  );
}

export default Section;
