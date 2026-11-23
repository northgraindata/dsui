import { type ComponentProps, useEffect, useId, useRef, useState } from "react";
import { Input } from "./input";

export type SuggestOption = {
  value: string;
  /** Shown instead of the value when it reads better. */
  label?: string;
  description?: string;
};

export type SuggestInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "role"
> & {
  value: string;
  onValueChange(value: string): void;
  /** What to offer. The input never filters them: the caller already did. */
  options: SuggestOption[];
  loading?: boolean;
  /** Names the list for assistive technology. The input keeps its own label. */
  listLabel?: string;
  /** Called when the list opens or the text changes, so a caller can fetch. */
  onSuggest?(): void;
  /** Called with a chosen option. Defaults to `onValueChange(option.value)`. */
  onSelectOption?(option: SuggestOption): void;
};

/**
 * A text input that offers matches while it has focus.
 *
 * Typing stays free: the list only helps fill the field in, so a value that is
 * not on it is still accepted. The list is a popover so a scrolling or clipped
 * container, such as a dialog body, cannot cut it off.
 */
export function SuggestInput({
  value,
  onValueChange,
  options,
  loading = false,
  listLabel = "Suggestions",
  onSuggest,
  onSelectOption,
  onFocus,
  onBlur,
  onClick,
  onKeyDown,
  ...input
}: SuggestInputProps) {
  const field = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  // The chosen entry belongs to one list. A new list starts with nothing
  // chosen, so Enter still submits the form.
  const [choice, setChoice] = useState({ options, index: -1 });
  const active = choice.options === options ? choice.index : -1;
  const setActive = (next: (current: number) => number) =>
    setChoice((current) => ({
      options,
      index: next(current.options === options ? current.index : -1),
    }));
  const visible = open && (loading || options.length > 0);

  useEffect(() => {
    const popup = menu.current;
    if (!popup) return;
    if (!visible) {
      if (popup.matches(":popover-open")) popup.hidePopover();
      return;
    }
    const place = () => {
      const bounds = field.current?.getBoundingClientRect();
      if (!bounds) return;
      const availableBelow = window.innerHeight - bounds.bottom - 12;
      const above = availableBelow < 150 && bounds.top > availableBelow;
      popup.style.width = `${bounds.width}px`;
      popup.style.left = `${bounds.left}px`;
      popup.style.maxHeight = `${Math.max(100, Math.min(260, above ? bounds.top - 16 : availableBelow))}px`;
      // Anchored by the edge that touches the input, so the list can grow or
      // shrink with its content without being measured.
      popup.style.top = above ? "auto" : `${bounds.bottom + 6}px`;
      popup.style.bottom = above
        ? `${window.innerHeight - bounds.top + 6}px`
        : "auto";
    };
    if (!popup.matches(":popover-open")) popup.showPopover();
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [visible]);

  useEffect(() => {
    document
      .getElementById(`${menuId}-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, menuId]);

  const choose = (option: SuggestOption) => {
    if (onSelectOption) onSelectOption(option);
    else onValueChange(option.value);
    setOpen(false);
  };

  return (
    <>
      <Input
        {...input}
        ref={field}
        role="combobox"
        aria-expanded={visible}
        aria-controls={menuId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${menuId}-${active}` : undefined}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
          onSuggest?.();
        }}
        onFocus={(event) => {
          setOpen(true);
          onSuggest?.();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setOpen(false);
          onBlur?.(event);
        }}
        // Focus is already there after Escape, so a click is how it comes back.
        onClick={(event) => {
          setOpen(true);
          onSuggest?.();
          onClick?.(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "Escape" && visible) {
            // Closes the list, not the dialog the input sits in.
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            if (options.length === 0) return;
            event.preventDefault();
            if (!open) setOpen(true);
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((current) =>
              current === -1 && step === -1
                ? options.length - 1
                : (current + step + options.length) % options.length,
            );
          } else if (event.key === "Enter" && visible && active >= 0) {
            event.preventDefault();
            choose(options[active]);
          }
        }}
      />
      <div
        ref={menu}
        id={menuId}
        popover="manual"
        role="listbox"
        aria-label={listLabel}
        className="dsui-suggest-menu"
      >
        {loading && options.length === 0 ? (
          <div className="dsui-suggest-status">Searching…</div>
        ) : (
          options.map((option, index) => (
            // Keyboard use stays in the input (aria-activedescendant), so the
            // options only need to answer the pointer.
            // biome-ignore lint/a11y/useKeyWithClickEvents: see above
            <div
              key={option.value}
              id={`${menuId}-${index}`}
              role="option"
              tabIndex={-1}
              aria-selected={index === active}
              className="dsui-suggest-option"
              // Keeps focus in the input, so choosing does not blur it first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              <strong>{option.label ?? option.value}</strong>
              {option.description && <small>{option.description}</small>}
            </div>
          ))
        )}
      </div>
    </>
  );
}
