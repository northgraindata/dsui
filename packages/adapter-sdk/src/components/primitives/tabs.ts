import { defineComponent } from "../define";
import type { PageNode } from "../nodes";

export interface TabsItem {
  label: string;
  content: PageNode | readonly PageNode[];
  link?: string;
}

export interface TabsProps {
  items: readonly TabsItem[];
  defaultIndex?: number;
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
    for (const item of props.items) {
      if (item.link && !item.link.startsWith("/"))
        throw new Error("Tabs item link must be absolute");
    }
    if (
      props.defaultIndex !== undefined &&
      (props.defaultIndex < 0 || props.defaultIndex >= props.items.length)
    )
      throw new Error("Tabs defaultIndex must reference an item");
    return {
      kind: "tabs",
      props: {
        items: [...props.items],
        ...(props.defaultIndex === undefined
          ? {}
          : { defaultIndex: props.defaultIndex }),
        ...(props.variant ? { variant: props.variant } : {}),
      },
    };
  },
});
