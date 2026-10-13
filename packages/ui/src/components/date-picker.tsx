import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export type DatePickerProps = {
  id?: string;
  ariaLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
    ? date
    : null;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayKey(): string {
  const today = new Date();
  return dateKey(
    new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())),
  );
}

function allowed(value: string, min?: string, max?: string): boolean {
  return (!min || value >= min) && (!max || value <= max);
}

function shiftMonth(date: Date, amount: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1),
  );
}

function keyboardDate(day: Date, key: string): Date | null {
  const dayOffset: Record<string, number> = {
    ArrowRight: 1,
    ArrowLeft: -1,
    ArrowDown: 7,
    ArrowUp: -7,
    Home: -((day.getUTCDay() + 6) % 7),
    End: 6 - ((day.getUTCDay() + 6) % 7),
  };
  if (key in dayOffset)
    return new Date(day.getTime() + dayOffset[key] * 86400000);
  if (key !== "PageUp" && key !== "PageDown") return null;
  const targetMonth = shiftMonth(day, key === "PageUp" ? -1 : 1);
  const lastDay = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      targetMonth.getUTCFullYear(),
      targetMonth.getUTCMonth(),
      Math.min(day.getUTCDate(), lastDay),
    ),
  );
}

export function DatePicker({
  id,
  ariaLabel,
  value,
  onValueChange,
  min,
  max,
  placeholder = "Choose date",
  disabled = false,
  className = "",
}: DatePickerProps) {
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parseDate(value) ?? new Date());
  const [focusedDate, setFocusedDate] = useState("");
  const selectedDate = parseDate(value);
  const currentMonth = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1),
  );
  const firstWeekday = (currentMonth.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const days = Array.from(
    { length: cellCount },
    (_, index) =>
      new Date(
        Date.UTC(
          currentMonth.getUTCFullYear(),
          currentMonth.getUTCMonth(),
          index - firstWeekday + 1,
        ),
      ),
  );
  const previousMonth = shiftMonth(currentMonth, -1);
  const nextMonth = shiftMonth(currentMonth, 1);
  const canGoPrevious =
    !min || dateKey(currentMonth).slice(0, 7) > min.slice(0, 7);
  const canGoNext = !max || dateKey(nextMonth).slice(0, 7) <= max.slice(0, 7);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    const popup = menu.current;
    if (!open || !popup) return;
    const place = () => {
      const bounds = trigger.current?.getBoundingClientRect();
      if (!bounds) return;
      const width = Math.min(304, window.innerWidth - 16);
      const left = Math.max(
        8,
        Math.min(bounds.left, window.innerWidth - width - 8),
      );
      const roomBelow = window.innerHeight - bounds.bottom - 12;
      const above = roomBelow < 320 && bounds.top > roomBelow;
      popup.style.width = `${width}px`;
      popup.style.left = `${left}px`;
      popup.style.maxHeight = `${Math.max(120, above ? bounds.top - 16 : roomBelow)}px`;
      popup.style.top = above
        ? `${Math.max(8, bounds.top - Math.min(popup.scrollHeight, bounds.top - 16) - 8)}px`
        : `${bounds.bottom + 6}px`;
    };
    popup.showPopover();
    place();
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

  useEffect(() => {
    if (open && focusedDate)
      menu.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${focusedDate}"]`)
        ?.focus({ preventScroll: true });
  }, [open, focusedDate]);

  const openCalendar = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const today = todayKey();
    let first = today;
    if (selectedDate && allowed(value, min, max)) first = value;
    else if (!allowed(today, min, max)) first = min ?? max ?? today;
    setMonth(parseDate(first) ?? new Date());
    setFocusedDate(first);
    setOpen(true);
  };

  const choose = (next: string) => {
    onValueChange(next);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };

  const moveFocus = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    day: Date,
  ) => {
    const next = keyboardDate(day, event.key);
    if (!next) return;
    event.preventDefault();
    const key = dateKey(next);
    if (!allowed(key, min, max)) return;
    setMonth(next);
    setFocusedDate(key);
  };

  const navigateMonth = (target: Date) => {
    const first = dateKey(target);
    const focus = min && min > first ? min : first;
    setMonth(target);
    setFocusedDate(focus);
  };

  return (
    <div className={`dsui-date-picker ${className}`} ref={root}>
      <button
        id={id}
        ref={trigger}
        type="button"
        className="dsui-date-picker-trigger"
        aria-label={`${ariaLabel}: ${selectedDate ? longDateFormatter.format(selectedDate) : placeholder}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={openCalendar}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4m10-4v4M3 10h18" />
        </svg>
        <span className={selectedDate ? "" : "dsui-date-picker-placeholder"}>
          {selectedDate ? dateFormatter.format(selectedDate) : placeholder}
        </span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m7 10 5 5 5-5" />
        </svg>
      </button>
      <div
        ref={menu}
        id={menuId}
        className="dsui-date-picker-menu"
        role="dialog"
        aria-label={`${ariaLabel} calendar`}
        popover="manual"
      >
        <div className="dsui-date-picker-heading">
          <strong aria-live="polite">
            {monthFormatter.format(currentMonth)}
          </strong>
          <div>
            <button
              type="button"
              aria-label="Previous month"
              disabled={!canGoPrevious}
              onClick={() => navigateMonth(previousMonth)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              disabled={!canGoNext}
              onClick={() => navigateMonth(nextMonth)}
            >
              ›
            </button>
          </div>
        </div>
        <fieldset
          className="dsui-date-picker-grid"
          aria-label={monthFormatter.format(currentMonth)}
        >
          {weekdays.map((weekday) => (
            <span
              key={weekday}
              className="dsui-date-picker-weekday"
              aria-hidden="true"
            >
              {weekday}
            </span>
          ))}
          {days.map((day) => {
            const key = dateKey(day);
            const inMonth = day.getUTCMonth() === currentMonth.getUTCMonth();
            return (
              <button
                key={key}
                type="button"
                data-date={key}
                aria-label={longDateFormatter.format(day)}
                aria-pressed={key === value}
                aria-current={key === todayKey() ? "date" : undefined}
                className={inMonth ? "" : "dsui-date-picker-outside"}
                disabled={!allowed(key, min, max)}
                tabIndex={key === focusedDate ? 0 : -1}
                onClick={() => choose(key)}
                onKeyDown={(event) => moveFocus(event, day)}
              >
                {day.getUTCDate()}
              </button>
            );
          })}
        </fieldset>
        <div className="dsui-date-picker-footer">
          <button type="button" disabled={!value} onClick={() => choose("")}>
            Clear
          </button>
          <button
            type="button"
            disabled={!allowed(todayKey(), min, max)}
            onClick={() => choose(todayKey())}
          >
            Today
          </button>
        </div>
      </div>
    </div>
  );
}
