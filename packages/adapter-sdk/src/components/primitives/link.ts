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

export const Link = defineComponent<LinkProps>({
  id: "link",
  path: "./ui/link",
});
