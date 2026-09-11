import { defineComponent } from "../define";
import type { FieldReference } from "./collection";

export type BadgeTone =
  | "healthy"
  | "warning"
  | "unavailable"
  | "info"
  | "muted";

export interface BadgeProps {
  label: string | FieldReference;
  tone?: BadgeTone | FieldReference;
  dot?: boolean;
}

export interface BadgeNode {
  readonly kind: "badge";
  readonly props: BadgeProps;
}

export const Badge = defineComponent<BadgeProps, BadgeNode>({
  id: "badge",
  render: (props) => ({ kind: "badge", props: { ...props } }),
});
