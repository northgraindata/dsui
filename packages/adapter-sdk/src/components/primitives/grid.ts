import { defineComponent } from "../define";
import type { PageNode } from "../nodes";
import type { LayoutGap } from "./stack";

export interface GridProps {
  content: PageNode | readonly PageNode[];
  columns?: number;
  gap?: LayoutGap;
}

export interface GridNode {
  readonly kind: "grid";
  readonly props: GridProps;
}

export const Grid = defineComponent<GridProps, GridNode>({
  id: "grid",
  render: (props) => {
    if (
      props.columns !== undefined &&
      (!Number.isInteger(props.columns) || props.columns < 1 || props.columns > 6)
    ) {
      throw new Error("Grid columns must be an integer between 1 and 6");
    }
    return {
      kind: "grid",
      props: {
        ...props,
        gap: props.gap ?? "md",
      },
    };
  },
});
