import { defineComponent } from "../define";
import type { FieldReference } from "./collection";

export interface CodeBlockProps {
  label: string | FieldReference;
  value: string | FieldReference;
  language?: "sql" | "text" | FieldReference;
}

export interface CodeBlockNode {
  readonly kind: "code-block";
  readonly props: CodeBlockProps;
}

export const CodeBlock = defineComponent<CodeBlockProps, CodeBlockNode>({
  id: "code-block",
  render: (props) => ({ kind: "code-block", props: { ...props } }),
});
