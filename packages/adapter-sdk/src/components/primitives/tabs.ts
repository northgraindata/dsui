import { defineComponent } from "../define";
import type { PageNode } from "../nodes";

export interface TabsItem {
  label: string;
  content: PageNode | readonly PageNode[];
}

export interface TabsProps {
  items: readonly TabsItem[];
  variant?: "default" | "detail";
}

export interface TabsNode {
  readonly kind: "tabs";
  readonly props: TabsProps;
}

export const Tabs = defineComponent<TabsProps, TabsNode>({
  id: "tabs",
  render: (props) => {
    if (props.items.length === 0)
      throw new Error("Tabs requires at least one item");
    return { kind: "tabs", props: { items: [...props.items] } };
  },
});
