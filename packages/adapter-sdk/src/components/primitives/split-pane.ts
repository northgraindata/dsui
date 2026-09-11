import { defineComponent } from "../define";
import type { PageNode } from "../nodes";

export interface SplitPaneProps {
  sidebar: PageNode | readonly PageNode[];
  content: PageNode | readonly PageNode[];
  inspector?: PageNode | readonly PageNode[];
}

export interface SplitPaneNode {
  readonly kind: "split-pane";
  readonly props: SplitPaneProps;
}

export const SplitPane = defineComponent<SplitPaneProps, SplitPaneNode>({
  id: "split-pane",
  render: (props) => ({ kind: "split-pane", props: { ...props } }),
});
