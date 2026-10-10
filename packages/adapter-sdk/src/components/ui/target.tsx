import { Fragment } from "react";
import type { TargetProps } from "../primitives/target";
import { type ComponentProps, componentProps } from "../runtime";

export default function Target({
  client,
  node,
  context,
  renderNode,
}: ComponentProps) {
  const props = componentProps<TargetProps>(node);
  if (!props) return null;
  const children = Array.isArray(props.content)
    ? props.content
    : [props.content];
  return (
    <div data-dsui-overlay-target={props.id}>
      {children.map((child) => (
        <Fragment key={JSON.stringify(child)}>
          {renderNode(client, child, context)}
        </Fragment>
      ))}
    </div>
  );
}
