import { Select as UiSelect } from "@northgraindata/dsui-ui";
import type { SelectProps } from "../primitives/select";
import { type ComponentProps, componentProps } from "../runtime";

export function Select({ node }: ComponentProps) {
  const props = componentProps<SelectProps>(node);
  if (!props) return null;
  return (
    <UiSelect
      ariaLabel={props.label ?? props.name}
      defaultValue={props.value ?? ""}
      options={props.options}
    />
  );
}

export default Select;
