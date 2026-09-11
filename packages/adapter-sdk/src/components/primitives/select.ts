import { defineComponent } from "../define";
export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  name: string;
  label?: string;
  options: readonly SelectOption[];
  value?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
}

export interface SelectNode {
  readonly kind: "select";
  readonly props: SelectProps;
}

export const Select = defineComponent<SelectProps, SelectNode>({
  id: "select",
  render: (props) => {
    if (!props.name) throw new Error("Select requires a field name");
    return { kind: "select", props: { ...props, options: [...props.options] } };
  },
});
