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

export const TextInput = defineComponent<TextInputProps, TextInputNode>({
  id: "text-input",
  render: (props) => {
    if (!props.name) throw new Error("TextInput requires a field name");
    return { kind: "text-input", props: { ...props } };
  },
});
