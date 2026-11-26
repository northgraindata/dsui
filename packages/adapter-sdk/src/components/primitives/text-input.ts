import { defineComponent } from "../define";
import type { FieldReference } from "./collection";
export interface TextInputProps {
  name: string;
  label?: string;
  /** Text, or `{ field }` to read it from the record in context. */
  value?: string | FieldReference;
  onChange?: (value: string) => void;
  placeholder?: string;
  secret?: boolean;
}

export interface TextInputNode {
  readonly kind: "text-input";
  readonly props: TextInputProps;
}

export const TextInput = defineComponent<TextInputProps>({
  id: "text-input",
  path: "./ui/text-input",
});
