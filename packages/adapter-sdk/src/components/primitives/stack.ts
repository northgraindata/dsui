import { defineComponent } from "../define";
import type { PageNode } from "../nodes";

export type LayoutGap = "none" | "sm" | "md" | "lg";

export interface StackProps {
  content: PageNode | readonly PageNode[];
  gap?: LayoutGap;
}

export interface StackNode {
  readonly kind: "stack";
  readonly props: StackProps;
}

export const Stack = defineComponent<StackProps, StackNode>({
  id: "stack",
  render: (props) => ({
    kind: "stack",
    props: {
      ...props,
      gap: props.gap ?? "md",
    },
  }),
});
