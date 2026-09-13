import type { ActionTarget } from "../../action";
import { defineComponent } from "../define";

export type NotebookBlock =
  | { id: string; kind: "markdown"; content: string }
  | {
      id: string;
      kind: "code";
      language: string;
      content: string;
      action: ActionTarget | string;
    };

export interface NotebookProps {
  title: string;
  description?: string;
  blocks: readonly NotebookBlock[];
}

export interface NotebookNode {
  readonly kind: "notebook";
  readonly props: NotebookProps;
}

export const Notebook = defineComponent<NotebookProps, NotebookNode>({
  id: "notebook",
  render: (props) => ({ kind: "notebook", props: { ...props } }),
});
