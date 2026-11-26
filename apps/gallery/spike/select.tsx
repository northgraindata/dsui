import * as RadixSelect from "@radix-ui/react-select";
import { cva, type VariantProps } from "class-variance-authority";

/** One place that decides how a select looks; a new look is a new variant. */
const trigger = cva(
  "inline-flex min-w-0 items-center justify-between gap-2 rounded-lg border text-[12px] outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-control-border bg-control text-text-bright hover:border-focus data-[state=open]:border-focus",
        ghost:
          "border-transparent bg-transparent text-secondary hover:bg-surface-hover hover:text-primary",
      },
      size: { default: "h-9 px-2.5", small: "h-7 px-2 text-[11px]" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectProps = VariantProps<typeof trigger> & {
  ariaLabel: string;
  options: readonly SelectOption[];
  value?: string;
  placeholder?: string;
  onValueChange?: (value: string) => void;
};

export function Select({
  ariaLabel,
  options,
  value,
  placeholder = "Select…",
  onValueChange,
  variant,
  size,
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        className={trigger({ variant, size })}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon aria-hidden="true">▾</RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-64 min-w-(--radix-select-trigger-width) overflow-auto rounded-lg border border-control-border bg-surface-raised p-1 shadow-lg"
        >
          <RadixSelect.Viewport>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-2.5 py-1.5 text-[12px] text-text-bright outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-control-active"
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator>✓</RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
