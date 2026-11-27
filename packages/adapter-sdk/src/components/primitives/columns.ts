import { defineComponent } from "../define";
import type { PageNode } from "../nodes";
import type { LayoutGap } from "./stack";

export interface ColumnsColumn {
  weight?: number;
  content: PageNode | readonly PageNode[];
}

export interface ColumnsProps {
  columns: readonly ColumnsColumn[];
  /** Space between columns, and between the items inside each column. */
  gap?: LayoutGap;
}

export interface ColumnsNode {
  readonly kind: "columns";
  readonly props: ColumnsProps;
}

export const Columns = defineComponent<ColumnsProps, ColumnsNode>({
  id: "columns",
  render: (props) => {
    if (props.columns.length === 0)
      throw new Error("Columns requires at least one column");
    return {
      kind: "columns",
      props: { ...props, columns: [...props.columns] },
    };
  },
});
