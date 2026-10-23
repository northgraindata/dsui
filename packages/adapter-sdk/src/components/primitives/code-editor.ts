import type { ActionReference } from "../../action";
import { defineComponent } from "../define";
export interface CodeEditorProps {
  language: string;
  value: string;
  path?: string;
  readOnly?: boolean;
  onChangeAction?: ActionReference;
  /** Browser-only callback; use onChangeAction for serialized page documents. */
  onChange?: (value: string) => void;
}

export interface CodeEditorNode {
  readonly kind: "code-editor";
  readonly props: CodeEditorProps;
}

export const CodeEditor = defineComponent<CodeEditorProps, CodeEditorNode>({
  id: "code-editor",
  render: (props) => ({ kind: "code-editor", props: { ...props } }),
});
