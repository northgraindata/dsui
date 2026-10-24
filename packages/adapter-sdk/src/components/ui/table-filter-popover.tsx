import type { RefObject } from "react";
import type { TableColumn } from "../primitives/table";
import { WorkbenchIcon } from "./icons";
import type { FilterOption, SortDirection } from "./table-data";

export function TableFilterPopover({
  column,
  columns,
  options,
  position,
  draft,
  sort,
  search,
  menuRef,
  onColumnChange,
  onSearchChange,
  onDraftChange,
  onSort,
  onClear,
  onClose,
  onApply,
}: {
  column: TableColumn;
  columns: readonly TableColumn[];
  options: FilterOption[];
  position: { top: number; left: number };
  draft: string[];
  sort?: { columnId: string; direction: SortDirection };
  search: string;
  menuRef: RefObject<HTMLDivElement | null>;
  onColumnChange: (columnId: string) => void;
  onSearchChange: (value: string) => void;
  onDraftChange: (keys: string[]) => void;
  onSort: (direction: SortDirection) => void;
  onClear: () => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const matching = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const shown = matching.slice(0, 100);
  const selected = new Set(draft);

  return (
    <div
      ref={menuRef}
      className="table-filter-popover"
      role="dialog"
      aria-label={`Filter ${column.label}`}
      style={position}
    >
      <header className="table-filter-heading">
        <span className="table-filter-heading-icon">
          <WorkbenchIcon name="filter" size={17} />
        </span>
        <span>
          <small>FILTER COLUMN</small>
          <strong>{column.label}</strong>
        </span>
        <button type="button" aria-label="Close filter" onClick={onClose}>
          <WorkbenchIcon name="close" size={16} />
        </button>
      </header>

      <div className="table-filter-body">
        <label className="table-filter-column">
          <span>Column</span>
          <select
            value={column.id}
            onChange={(event) => onColumnChange(event.target.value)}
          >
            {columns.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="table-filter-section-heading">
          <span>
            Values <small>{options.length} distinct</small>
          </span>
          <small>Loaded preview</small>
        </div>
        <label className="table-filter-search">
          <WorkbenchIcon name="search" size={16} />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Find a value…"
            aria-label={`Search ${column.label} values`}
          />
        </label>
        <div className="table-filter-selection-tools">
          <span>
            {draft.length ? `${draft.length} selected` : "All values"}
          </span>
          <div>
            <button
              type="button"
              disabled={shown.length === 0}
              onClick={() =>
                onDraftChange([
                  ...new Set([...draft, ...shown.map((item) => item.key)]),
                ])
              }
            >
              Select shown
            </button>
            <button
              type="button"
              disabled={draft.length === 0}
              onClick={() => onDraftChange([])}
            >
              Deselect all
            </button>
          </div>
        </div>
        <div className="table-filter-options">
          {shown.map((option) => (
            <label key={option.key} className="table-filter-option">
              <input
                type="checkbox"
                checked={selected.has(option.key)}
                onChange={() =>
                  onDraftChange(
                    selected.has(option.key)
                      ? draft.filter((key) => key !== option.key)
                      : [...draft, option.key],
                  )
                }
              />
              <span title={option.label}>{option.label}</span>
              <small>{option.count}</small>
            </label>
          ))}
          {matching.length > shown.length && (
            <p>
              Showing {shown.length} of {matching.length}. Refine your search to
              see more.
            </p>
          )}
          {matching.length === 0 && <p>No matching values</p>}
        </div>

        <div className="table-filter-sort">
          <span>Sort this column</span>
          <div>
            <button
              type="button"
              aria-pressed={
                sort?.columnId === column.id && sort.direction === "asc"
              }
              onClick={() => onSort("asc")}
            >
              <WorkbenchIcon name="sort" size={15} /> Ascending
            </button>
            <button
              type="button"
              aria-pressed={
                sort?.columnId === column.id && sort.direction === "desc"
              }
              onClick={() => onSort("desc")}
            >
              <WorkbenchIcon name="sort" size={15} /> Descending
            </button>
          </div>
        </div>
      </div>

      <footer className="table-filter-actions">
        <button type="button" onClick={onClear}>
          Clear filter
        </button>
        <div>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={onApply}>
            Apply filter
          </button>
        </div>
      </footer>
    </div>
  );
}
