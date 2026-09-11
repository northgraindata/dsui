import { defineComponent } from "../define";
import type { FieldReference } from "./collection";

export interface IconProps {
  name: string | FieldReference;
  size?: number;
}

export interface IconNode {
  readonly kind: "icon";
  readonly props: IconProps;
}

export const Icon = defineComponent<IconProps, IconNode>({
  id: "icon",
  render: (props) => ({ kind: "icon", props: { ...props } }),
});
