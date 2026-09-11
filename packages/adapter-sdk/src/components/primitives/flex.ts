import { defineComponent } from "../define";
import type { PageNode } from "../nodes";
import type { LayoutGap } from "./stack";

export type FlexDirection = "row" | "column";
export type FlexAlign = "start" | "center" | "end" | "stretch";
export type FlexJustify = "start" | "center" | "end" | "between";

export interface FlexProps {
  content: PageNode | readonly PageNode[];
  direction?: FlexDirection;
  gap?: LayoutGap;
  align?: FlexAlign;
  justify?: FlexJustify;
  wrap?: boolean;
}

export interface FlexNode {
  readonly kind: "flex";
  readonly props: FlexProps;
}

export const Flex = defineComponent<FlexProps, FlexNode>({
  id: "flex",
  render: (props) => ({
    kind: "flex",
    props: {
      ...props,
      direction: props.direction ?? "row",
      gap: props.gap ?? "md",
      align: props.align ?? "stretch",
      justify: props.justify ?? "start",
      wrap: props.wrap ?? false,
    },
  }),
});
