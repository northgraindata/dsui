import { defineComponent } from "../define";
import type { FieldReference } from "./collection";

export interface CodeBlockProps {
  label: string | FieldReference;
  value: string | FieldReference;
  language?: "python" | "sql" | "text" | FieldReference;
}

export interface CodeBlockNode {
  readonly kind: "code-block";
  readonly props: CodeBlockProps;
}

export const CodeBlock = defineComponent<CodeBlockProps>({
  id: "code-block",
  path: "./ui/code-block",
});
