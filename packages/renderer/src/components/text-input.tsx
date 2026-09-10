import { Input } from "@northgraindata/dsui-ui";
import type { RegistryViewProps } from "../registry/view-registry";

export function TextInputView({ node }: RegistryViewProps) {
  if (node.kind !== "text-input") return null;
  return (
    <Input
      aria-label={node.props.label ?? node.props.name}
      type={node.props.secret ? "password" : "text"}
      defaultValue={node.props.value}
      placeholder={node.props.placeholder}
    />
  );
}
