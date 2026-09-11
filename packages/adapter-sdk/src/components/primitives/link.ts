import { defineComponent } from "../define";
import type { FieldReference } from "./collection";

export interface LinkProps {
  href: string | FieldReference;
  label: string | FieldReference;
  icon?: string | FieldReference;
  external?: boolean;
}

export interface LinkNode {
  readonly kind: "link";
  readonly props: LinkProps;
}

export const Link = defineComponent<LinkProps, LinkNode>({
  id: "link",
  render: (props) => ({ kind: "link", props: { ...props } }),
});
