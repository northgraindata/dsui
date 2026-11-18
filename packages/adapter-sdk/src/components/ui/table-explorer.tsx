import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TableColumn, TableFilter } from "../primitives/table";
import { WorkbenchIcon } from "./icons";
import {
  type ColumnFilter,
  columnOptions,
  exploreRows,
  type SortDirection,
  tableInsights,
} from "./table-data";
import { TableFilterPopover } from "./table-filter-popover";
import { TableInsights } from "./table-insights";

type Sort = { columnId: string; direction: SortDirection };
type FilterMenu = { columnId: string; top: number; left: number };

function filterMenuPosition(trigger: HTMLElement, menuHeight = 440) {
  const rect = trigger.getBoundingClientRect();
  const gap = 6;
  const left = Math.max(8, Math.min(rect.left, innerWidth - 352));
  const below = rect.bottom + gap;
  const above = rect.top - gap - menuHeight;
  let top = below;
  if (below + menuHeight > innerHeight - 8) {
    top =
      above >= 8
        ? above
        : Math.max(8, Math.min(below, innerHeight - menuHeight - 8));
  }
  return { left, top };
}

function triggerIsVisible(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  if (
    rect.bottom <= 0 ||
    rect.top >= innerHeight ||
    rect.right <= 0 ||
    rect.left >= innerWidth
  )
    return false;
  for (
    let parent = trigger.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent);
    if (
      !/(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`)
    )
      continue;
    const boundary = parent.getBoundingClientRect();
    if (
      rect.bottom <= boundary.top ||
      rect.top >= boundary.bottom ||
      rect.right <= boundary.left ||
      rect.left >= boundary.right
    )
      return false;
  }
  return true;
}

export function TableExplorer({
  rows,
  columns,
  filters: declaredFilters,
  insights,
  renderTable,
}: {
  rows: readonly Record<string, unknown>[];
  columns: readonly TableColumn[];
  filters?: readonly TableFilter[];
  insights: boolean;
  renderTable: (
    visibleRows: Record<string, unknown>[],
    renderHeader: (column: TableColumn) => ReactNode,
  ) => ReactNode;
}) {
  const [filters, setFilters] = useState<ColumnFilter>({});
  const [sort, setSort] = useState<Sort>();
  const [draftSort, setDraftSort] = useState<Sort>();
  const [menu, setMenu] = useState<FilterMenu>();
  const [draft, setDraft] = useState<string[]>([]);
  const [valueSearch, setValueSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const menuOpen = menu !== undefined;
  const visibleRows = exploreRows({ rows, columns, search: "", filters, sort });
  const profile = insights ? tableInsights(rows, columns) : undefined;
  const activeColumn = columns.find((column) => column.id === menu?.columnId);
  const options = activeColumn
    ? columnOptions(
        rows,
        activeColumn.id,
        declaredFilters?.find((filter) => filter.field === activeColumn.id),
      )
    : [];

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      )
        setMenu(undefined);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(undefined);
    };
    const reposition = () => {
      const trigger = triggerRef.current;
      if (!trigger?.isConnected || !triggerIsVisible(trigger)) {
        setMenu(undefined);
        return;
      }
      const position = filterMenuPosition(
        trigger,
        menuRef.current?.offsetHeight,
      );
      setMenu((current) =>
        current &&
        (current.top !== position.top || current.left !== position.left)
          ? { ...current, ...position }
          : current,
      );
    };
    reposition();
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("scroll", reposition, true);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    const observer = new ResizeObserver(reposition);
    if (menuRef.current) observer.observe(menuRef.current);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("scroll", reposition, true);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      observer.disconnect();
    };
  }, [menuOpen]);

  const openFilter = (columnId: string, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setMenu({ columnId, ...filterMenuPosition(trigger) });
    setDraft(filters[columnId] ?? []);
    setDraftSort(sort);
    setValueSearch("");
  };

  const clearColumn = (columnId: string) => {
    setFilters((current) => {
      const next = { ...current };
      delete next[columnId];
      return next;
    });
    setMenu(undefined);
  };

  const renderHeader = (column: TableColumn) => (
    <span className="table-explorer-header">
      <span>{column.label}</span>
      <button
        type="button"
        aria-label={`Sort ${column.label}`}
        aria-pressed={sort?.columnId === column.id}
        title={`Sort ${column.label}`}
        onClick={() =>
          setSort((current) => ({
            columnId: column.id,
            direction:
              current?.columnId === column.id && current.direction === "asc"
                ? "desc"
                : "asc",
          }))
        }
      >
        <WorkbenchIcon name="sort" size={15} />
      </button>
      <button
        type="button"
        aria-label={`Filter ${column.label}`}
        aria-pressed={Boolean(filters[column.id]?.length)}
        title={`Filter ${column.label}`}
        onClick={(event) => openFilter(column.id, event.currentTarget)}
      >
        <WorkbenchIcon name="filter" size={15} />
      </button>
    </span>
  );

  return (
    <div className="table-explorer">
      {profile && <TableInsights data={profile} />}
      <div className="table-explorer-toolbar">
        <button
          type="button"
          className="table-explorer-clear"
          onClick={() => {
            setFilters({});
            setSort(undefined);
          }}
        >
          Clear all
        </button>
      </div>
      {renderTable(visibleRows, renderHeader)}
      {visibleRows.length === 0 && (
        <p className="table-explorer-empty">
          No matching rows in this preview.
        </p>
      )}
      {(visibleRows.length !== rows.length || sort) && (
        <p className="table-explorer-count">
          Showing {visibleRows.length} of {rows.length} loaded rows
        </p>
      )}
      {menu &&
        activeColumn &&
        createPortal(
          <TableFilterPopover
            column={activeColumn}
            columns={columns}
            options={options}
            position={{ top: menu.top, left: menu.left }}
            draft={draft}
            sort={draftSort}
            search={valueSearch}
            menuRef={menuRef}
            onColumnChange={(columnId) => {
              setMenu({ ...menu, columnId });
              setDraft(filters[columnId] ?? []);
              setValueSearch("");
            }}
            onSearchChange={setValueSearch}
            onDraftChange={setDraft}
            onSort={(direction) =>
              setDraftSort({ columnId: activeColumn.id, direction })
            }
            onClear={() => clearColumn(activeColumn.id)}
            onClose={() => setMenu(undefined)}
            onApply={() => {
              setFilters((current) => ({
                ...current,
                [activeColumn.id]: draft,
              }));
              setSort(draftSort);
              setMenu(undefined);
            }}
          />,
          document.body,
        )}
    </div>
  );
}
