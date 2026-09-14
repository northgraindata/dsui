import { Input } from "@northgraindata/dsui-ui";
import type { TextInputProps } from "../primitives/text-input";
import { type ComponentProps, componentProps } from "../runtime";

export function TextInput({ node }: ComponentProps) {
  const props = componentProps<TextInputProps>(node);
  if (!props) return null;
  return (
    <Input
      aria-label={props.label ?? props.name}
      type={props.secret ? "password" : "text"}
      defaultValue={props.value}
      placeholder={props.placeholder}
    />
  );
}

export default TextInput;
