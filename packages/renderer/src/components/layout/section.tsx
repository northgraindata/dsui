import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { ReactNode } from "react";
import type { RendererClient } from "../../types/renderer-types";

type RenderNode = (
  client: RendererClient,
  node: PageNode,
  context?: Record<string, unknown>,
) => ReactNode;

export function SectionView({
  client,
  node,
  renderNode,
}: {
  client: RendererClient;
  node: PageNode;
  renderNode: RenderNode;
}) {
  const content = Array.isArray(node.props.content)
    ? node.props.content
    : [node.props.content];
  const link = node.props.link;
  return (
    <section className="ov-section">
      <header className="ov-section-header">
        <div>
          <h2>{node.props.title}</h2>
          {node.props.description ? <p>{node.props.description}</p> : null}
        </div>
        {link ? (
          <button
            type="button"
            className="ov-section-link"
            onClick={() => client.navigate(link.path)}
          >
            {link.label}
            <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </header>
      {content.map((child: any) => renderNode(client, child))}
    </section>
  );
}
