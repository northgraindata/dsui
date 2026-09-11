import { defineComponent } from "../define";
import type { PageNode } from "../nodes";

export interface ColumnsColumn {
  weight?: number;
  content: PageNode | readonly PageNode[];
}

export interface ColumnsProps {
  columns: readonly ColumnsColumn[];
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
    return { kind: "columns", props: { ...props, columns: [...props.columns] } };
  },
});
