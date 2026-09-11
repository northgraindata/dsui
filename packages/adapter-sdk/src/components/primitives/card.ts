import { defineComponent } from "../define";
import type { PageNode } from "../nodes";
import type { FieldReference } from "./collection";
import type { TableRowLink } from "./table";

export type CardVariant = "default" | "subtle" | "metric" | "interactive" | "panel";
export type CardBadgeTone = "healthy" | "warning" | "unavailable" | "info";
export type CardValue = string | FieldReference;

export interface CardProps {
  content?: PageNode | readonly PageNode[];
  title?: CardValue;
  description?: CardValue;
  icon?: CardValue;
  badge?: CardValue;
  badgeTone?: CardBadgeTone | FieldReference;
  link?: TableRowLink;
  variant?: CardVariant;
}

export interface CardNode {
  readonly kind: "card";
  readonly props: CardProps;
}

export const Card = defineComponent<CardProps, CardNode>({
  id: "card",
  render: (props) => ({
    kind: "card",
    props: {
      ...props,
      variant: props.variant ?? "default",
    },
  }),
});
