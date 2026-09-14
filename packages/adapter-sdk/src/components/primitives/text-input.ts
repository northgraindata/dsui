import { defineComponent } from "../define";
export interface TextInputProps {
  name: string;
  label?: string;
  value?: string;
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
