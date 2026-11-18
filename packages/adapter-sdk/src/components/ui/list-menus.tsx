import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ListFilter } from "../primitives/list";
import type { TableRowAction } from "../primitives/table";
import { WorkbenchIcon } from "./icons";
import { isRowActionDisabled } from "./row-action";

type Row = Record<string, unknown>;
export type Selection = Record<string, readonly string[]>;

const MENU_WIDTH = 220;

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** Opens below its trigger, flipping above when there is no room. */
function usePopover() {
  const [position, setPosition] = useState<{ top: number; left: number }>();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const open = position !== undefined;

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(undefined);
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !trigger.current?.contains(target) &&
        !panel.current?.contains(target)
      )
        close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = (height: number) => {
    if (open || !trigger.current) {
      setPosition(undefined);
      return;
    }
    const rect = trigger.current.getBoundingClientRect();
    const below = rect.bottom + 6;
    setPosition({
      top:
        below + height > window.innerHeight - 8
          ? Math.max(8, rect.top - 6 - height)
          : below,
      left: Math.max(
        8,
        Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
      ),
    });
  };

  return {
    position,
    trigger,
    panel,
    toggle,
    close: () => setPosition(undefined),
  };
}

export function ActionMenu({
  title,
  row,
  actions,
  disabled,
  onRun,
}: {
  title: string;
  row: Row;
  actions: readonly TableRowAction[];
  disabled: boolean;
  onRun: (spec: TableRowAction) => void;
}) {
  const { position, trigger, panel, toggle, close } = usePopover();
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="dsui-list-action"
        aria-label={`More actions for ${title}`}
        aria-haspopup="menu"
        aria-expanded={position !== undefined}
        disabled={disabled}
        onClick={() => toggle(actions.length * 34 + 12)}
      >
        <WorkbenchIcon name="more" size={16} />
      </button>
      {position
        ? createPortal(
            <div
              ref={panel}
              role="menu"
              className="dsui-list-menu"
              style={{ ...position, width: MENU_WIDTH }}
            >
              {actions.map((spec) => (
                <button
                  key={spec.label}
                  type="button"
                  role="menuitem"
                  data-variant={spec.variant}
                  disabled={isRowActionDisabled(row, spec.disabledWhen)}
                  onClick={() => {
                    close();
                    onRun(spec);
                  }}
                >
                  {spec.icon ? (
                    <WorkbenchIcon name={spec.icon} size={14} />
                  ) : null}
                  {spec.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Declared options, or each distinct value of the field, sorted. */
function filterOptions(filter: ListFilter, rows: readonly Row[]) {
  if (filter.options) return filter.options;
  const values = new Set(rows.map((row) => text(row[filter.field])));
  values.delete("");
  return [...values]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ label: value, value }));
}

export function FilterMenu({
  filters,
  rows,
  selection,
  onChange,
}: {
  filters: readonly ListFilter[];
  rows: readonly Row[];
  selection: Selection;
  onChange: (next: Selection) => void;
}) {
  const { position, trigger, panel, toggle } = usePopover();
  const active = Object.values(selection).reduce(
    (count, values) => count + values.length,
    0,
  );
  const toggleValue = (field: string, value: string) => {
    const current = selection[field] ?? [];
    onChange({
      ...selection,
      [field]: current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    });
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="dsui-list-filter"
        aria-label="Filter"
        aria-haspopup="dialog"
        aria-expanded={position !== undefined}
        data-active={active > 0}
        onClick={() => toggle(320)}
      >
        <WorkbenchIcon name="filter" size={15} />
        {active ? <span>{active}</span> : null}
      </button>
      {position
        ? createPortal(
            <div
              ref={panel}
              role="dialog"
              aria-label="Filters"
              className="dsui-list-menu dsui-list-filters"
              style={{ ...position, width: MENU_WIDTH }}
            >
              {filters.map((filter) => (
                <fieldset key={filter.field}>
                  <legend>{filter.label}</legend>
                  {filterOptions(filter, rows).map((option) => (
                    <label key={option.value}>
                      <input
                        type="checkbox"
                        checked={(selection[filter.field] ?? []).includes(
                          option.value,
                        )}
                        onChange={() => toggleValue(filter.field, option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>
              ))}
              {active ? (
                <button
                  type="button"
                  className="dsui-list-filters-clear"
                  onClick={() => onChange({})}
                >
                  Clear filters
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
