import type { SelectProps } from "../primitives/select";
import { type ComponentProps, componentProps } from "../runtime";

export function Select({ node }: ComponentProps) {
  const props = componentProps<SelectProps>(node);
  if (!props) return null;
  return (
    <select
      aria-label={props.label ?? props.name}
      defaultValue={props.value ?? ""}
      className="min-h-[34px] border border-border-strong bg-background px-2.5 text-primary"
    >
      {props.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default Select;
