/* What every long list needs: search, filters, pages, and a memory of them. */
import { Button, Select } from "@northgraindata/dsui-ui";
import type { SelectOption } from "@northgraindata/dsui-ui/kit";
import { type ReactNode, useEffect, useState } from "react";
import { Glyph } from "./icons";

const memory = new Map<string, unknown>();

/** State that survives opening a record and coming back to its list. */
export function useRemembered<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(
    () => (memory.get(key) as T) ?? initial,
  );
  useEffect(() => {
    memory.set(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}

export const forget = (key: string) => memory.delete(key);

/**
 * One page of rows. In the product the server does this with `limit`,
 * `offset` and filters, so a list never loads everything.
 */
export function usePages<T>(key: string, rows: readonly T[], filters: string) {
  const [size, setSize] = useRemembered(`${key}:size`, 25);
  const [state, setState] = useRemembered(`${key}:page`, { filters, page: 0 });
  const last = Math.max(0, Math.ceil(rows.length / size) - 1);
  // A changed filter starts again at the first page.
  const page = state.filters === filters ? Math.min(state.page, last) : 0;
  const visible = rows.slice(page * size, (page + 1) * size);
  const pager = (
    <footer className="ax-pager">
      <span>
        {rows.length
          ? `${(page * size + 1).toLocaleString("en")}–${(page * size + visible.length).toLocaleString("en")} of ${rows.length.toLocaleString("en")}`
          : "0 results"}
      </span>
      <span className="ax-grow" />
      <span>Rows</span>
      <Select
        ariaLabel="Rows per page"
        size="small"
        value={String(size)}
        onValueChange={(next) => {
          setSize(Number(next));
          setState({ filters, page: 0 });
        }}
        options={["25", "50", "100"].map((value) => ({ value, label: value }))}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => setState({ filters, page: page - 1 })}
      >
        <Glyph name="left" />
      </Button>
      <span>
        Page {page + 1} of {last + 1}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Next page"
        disabled={page === last}
        onClick={() => setState({ filters, page: page + 1 })}
      >
        <Glyph name="right" />
      </Button>
    </footer>
  );
  return { visible, pager };
}

export function Segments<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; count?: number; tone?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="ax-segments">
      <legend>{label}</legend>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.tone ? (
            <i className="ax-dot" data-state={option.tone} />
          ) : null}
          {option.label}
          {option.count === undefined ? null : (
            <b>{option.count.toLocaleString("en")}</b>
          )}
        </button>
      ))}
    </fieldset>
  );
}

export function Search({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="ax-search">
      <Glyph name="search" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        aria-label={label}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
        >
          <Glyph name="close" size={13} />
        </button>
      ) : null}
    </label>
  );
}

/** A filter whose empty choice reads as "All …". */
export function Choice({
  all,
  value,
  options,
  names,
  rich,
  onChange,
}: {
  all: string;
  value: string;
  options: readonly string[];
  /** Labels for values that are not written for people. */
  names?: Readonly<Record<string, string>>;
  /** Ready-made options, for values that carry an icon. */
  rich?: { options: SelectOption[]; allIcon: ReactNode };
  onChange: (value: string) => void;
}) {
  return (
    <Select
      ariaLabel={all}
      value={value || "*"}
      onValueChange={(next) => onChange(next === "*" ? "" : next)}
      options={[
        { value: "*", label: all, icon: rich?.allIcon },
        ...(rich?.options ??
          options.map((option) => ({
            value: option,
            label: names?.[option] ?? option,
          }))),
      ]}
    />
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="ax-toolbar">{children}</div>;
}

export function Empty({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <div className="ax-empty">
      {filtered ? (
        <>
          <span>Nothing matches these filters.</span>
          <Button variant="secondary" size="small" onClick={onClear}>
            Clear filters
          </Button>
        </>
      ) : (
        <span>Nothing here yet.</span>
      )}
    </div>
  );
}

export const unique = (values: Iterable<string>) =>
  [...new Set(values)].filter(Boolean).sort();
