import * as RadixSelect from "@radix-ui/react-select";
import { useState } from "react";
import type { SelectOption, SelectProps } from "../kit";

/**
 * Radix reserves `""` for "nothing selected". Our pickers also offer it as a
 * real choice, such as "All states", so such an option travels under this name.
 */
const EMPTY = "__dsui_empty__";

/**
 * A modal `<dialog>` is drawn above the whole page and makes everything outside
 * it inert, so its list has to open inside it. Elsewhere the list goes to body.
 */
function useListContainer() {
  const [container, setContainer] = useState<HTMLElement>();
  const ref = (trigger: HTMLButtonElement | null) => {
    const dialog = trigger?.closest("dialog") ?? undefined;
    if (dialog !== container) setContainer(dialog);
  };
  return { container, ref };
}

const chevron = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="m7 10 5 5 5-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const check = (
  <svg
    className="dsui-select-check"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="m5 12 4 4 10-10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function Item({ option, icon }: { option: SelectOption; icon: boolean }) {
  return (
    <RadixSelect.Item
      className="dsui-select-option"
      value={option.value === "" ? EMPTY : option.value}
      textValue={option.label}
      disabled={option.disabled}
    >
      {icon && (
        <span className="dsui-select-icon" aria-hidden="true">
          {option.icon}
        </span>
      )}
      <span className="dsui-select-copy">
        <strong>
          <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
        </strong>
        {option.description && <small>{option.description}</small>}
      </span>
      <RadixSelect.ItemIndicator>{check}</RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
}

export function Select({
  id,
  name,
  ariaLabel,
  value,
  defaultValue = "",
  placeholder = "Select…",
  options,
  onValueChange,
  disabled = false,
  required = false,
  className = "",
  variant = "default",
  size = "default",
}: SelectProps) {
  const [own, setOwn] = useState(defaultValue);
  const { container, ref } = useListContainer();
  const current = value ?? own;
  const selected = options.find((option) => option.value === current);
  const offersEmpty = options.some((option) => option.value === "");
  // Icons align only when every option has one.
  const icons =
    options.length > 0 && options.every((option) => option.icon != null);

  return (
    <div className={`dsui-select ${className}`}>
      <RadixSelect.Root
        name={name}
        value={current === "" && offersEmpty ? EMPTY : current}
        required={required}
        disabled={disabled || options.every((option) => option.disabled)}
        onValueChange={(next) => {
          const chosen = next === EMPTY ? "" : next;
          if (value === undefined) setOwn(chosen);
          onValueChange?.(chosen);
        }}
      >
        <RadixSelect.Trigger
          id={id}
          ref={ref}
          className="dsui-select-trigger"
          data-variant={variant}
          data-size={size}
          aria-label={ariaLabel}
        >
          {icons && selected?.icon && (
            <span className="dsui-select-icon" aria-hidden="true">
              {selected.icon}
            </span>
          )}
          <span className="dsui-select-trigger-label">
            <RadixSelect.Value placeholder={placeholder} />
          </span>
          <RadixSelect.Icon asChild>{chevron}</RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal container={container}>
          <RadixSelect.Content
            className="dsui-select-menu"
            position="popper"
            sideOffset={6}
            collisionPadding={8}
          >
            <RadixSelect.Viewport>
              {options.map((option) => (
                <Item key={option.value} option={option} icon={icons} />
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
}
