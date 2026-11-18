import type * as ReactTypes from "react";

export type OptionSelectOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactTypes.ReactNode;
  disabled?: boolean;
};

export type OptionSelectProps = {
  id?: string;
  name?: string;
  ariaLabel?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  options: readonly OptionSelectOption[];
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

/** Accepting React keeps plugin pickers on the host's React instance. */
export function createOptionSelect(
  react: typeof ReactTypes | (() => typeof ReactTypes),
) {
  return function OptionSelect({
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
  }: OptionSelectProps) {
    const React = typeof react === "function" ? react() : react;
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const [open, setOpen] = React.useState(false);
    const root = React.useRef<HTMLDivElement>(null);
    const trigger = React.useRef<HTMLButtonElement>(null);
    const menu = React.useRef<HTMLDivElement>(null);
    const menuId = React.useId();
    const selectedValue = value ?? internalValue;
    const selected = options.find((option) => option.value === selectedValue);
    const showIcons =
      options.length > 0 && options.every((option) => option.icon != null);
    const enabled = options.filter((option) => !option.disabled);

    React.useEffect(() => {
      if (disabled) setOpen(false);
    }, [disabled]);

    React.useEffect(() => {
      const popup = menu.current;
      if (!popup || !open) return;
      const place = () => {
        const bounds = trigger.current?.getBoundingClientRect();
        if (!bounds) return;
        const width = Math.min(
          window.innerWidth - 16,
          Math.max(bounds.width, Math.min(300, window.innerWidth - 16)),
        );
        const left = Math.max(
          8,
          Math.min(bounds.left, window.innerWidth - width - 8),
        );
        const availableBelow = window.innerHeight - bounds.bottom - 12;
        const above = availableBelow < 170 && bounds.top > availableBelow;
        popup.style.width = `${width}px`;
        popup.style.left = `${left}px`;
        popup.style.maxHeight = `${Math.max(100, above ? bounds.top - 16 : availableBelow)}px`;
        popup.style.top = above
          ? `${Math.max(8, bounds.top - Math.min(popup.scrollHeight, bounds.top - 16) - 8)}px`
          : `${bounds.bottom + 6}px`;
      };
      popup.showPopover();
      place();
      const initial =
        popup.querySelector<HTMLButtonElement>(
          '[role="option"][aria-selected="true"]',
        ) ??
        popup.querySelector<HTMLButtonElement>(
          '[role="option"]:not(:disabled)',
        );
      initial?.focus({ preventScroll: true });
      const dismiss = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      };
      const outside = (event: PointerEvent) => {
        if (
          event.target instanceof Node &&
          !root.current?.contains(event.target) &&
          !popup.contains(event.target)
        )
          setOpen(false);
      };
      document.addEventListener("keydown", dismiss, true);
      document.addEventListener("pointerdown", outside);
      window.addEventListener("resize", place);
      window.addEventListener("scroll", place, true);
      return () => {
        popup.hidePopover();
        document.removeEventListener("keydown", dismiss, true);
        document.removeEventListener("pointerdown", outside);
        window.removeEventListener("resize", place);
        window.removeEventListener("scroll", place, true);
      };
    }, [open]);

    const choose = (next: string) => {
      if (value === undefined) setInternalValue(next);
      onValueChange?.(next);
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };

    return (
      <div className={`dsui-option-select ${className}`} ref={root}>
        <button
          id={id}
          ref={trigger}
          type="button"
          className="dsui-option-select-trigger"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={menuId}
          disabled={disabled || !enabled.length}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          {showIcons && selected?.icon && (
            <span className="dsui-option-select-icon" aria-hidden="true">
              {selected.icon}
            </span>
          )}
          <span className="dsui-option-select-trigger-label">
            {selected?.label ?? placeholder}
          </span>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m7 10 5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {(name || required) && (
          <select
            className="dsui-option-select-native"
            name={name}
            value={selectedValue}
            tabIndex={-1}
            aria-hidden="true"
            required={required}
            disabled={disabled}
            onChange={(event) => choose(event.target.value)}
            onInvalid={() => trigger.current?.focus()}
          >
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
        <div
          ref={menu}
          id={menuId}
          className="dsui-option-select-menu"
          role="listbox"
          aria-label={ariaLabel ?? "Options"}
          popover="manual"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="dsui-option-select-option"
              role="option"
              aria-selected={option.value === selectedValue}
              disabled={option.disabled}
              tabIndex={-1}
              onClick={() => choose(option.value)}
              onKeyDown={(event) => {
                const current = enabled.findIndex(
                  (item) => item.value === option.value,
                );
                let next = current;
                if (event.key === "ArrowDown")
                  next = (current + 1) % enabled.length;
                else if (event.key === "ArrowUp")
                  next = (current - 1 + enabled.length) % enabled.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = enabled.length - 1;
                else if (event.key === "Tab") {
                  setOpen(false);
                  return;
                } else return;
                event.preventDefault();
                const value = enabled[next]?.value;
                if (value === undefined) return;
                const index = options.findIndex((item) => item.value === value);
                menu.current
                  ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
                  [index]?.focus({ preventScroll: true });
              }}
            >
              {showIcons && (
                <span className="dsui-option-select-icon" aria-hidden="true">
                  {option.icon}
                </span>
              )}
              <span className="dsui-option-select-copy">
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
              {option.value === selectedValue && (
                <svg
                  className="dsui-option-select-check"
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
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };
}
