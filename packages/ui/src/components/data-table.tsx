import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Surface } from "./surface";

export function DataTable({
  columns,
  rows,
  onRowClick,
  renderCell,
  renderRowActions,
  renderRowMenu,
}: {
  columns: readonly { id: string; label: string }[];
  rows: readonly Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
  renderCell?: (
    columnId: string,
    value: unknown,
    row: Record<string, unknown>,
  ) => ReactNode;
  renderRowActions?: (row: Record<string, unknown>) => ReactNode;
  renderRowMenu?: (row: Record<string, unknown>) => ReactNode;
}) {
  return (
    <Surface className="dsui-data-table-shell overflow-x-auto">
      <table className="dsui-data-table w-full border-collapse text-left text-[12px]">
        <thead className="border-b border-border bg-surface-raised text-secondary">
          <tr>
            {columns.map((column) => (
              <th key={column.id} className="px-3 py-2 font-medium">
                {column.label}
              </th>
            ))}
            {renderRowActions !== undefined || renderRowMenu !== undefined ? (
              <th key="__actions" className="px-3 py-2 font-medium">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={JSON.stringify(row)}
              className="border-b border-border last:border-0"
            >
              {columns.map((column, index) => (
                <td
                  key={column.id}
                  className="max-w-72 truncate px-3 py-2 text-primary"
                >
                  {index === 0 && onRowClick ? (
                    <button
                      type="button"
                      onClick={() => onRowClick(row)}
                      className="dsui-data-table-cell-link cursor-pointer bg-transparent p-0 text-left"
                    >
                      {renderCell
                        ? renderCell(column.id, row[column.id], row)
                        : formatCell(row[column.id])}
                    </button>
                  ) : renderCell ? (
                    renderCell(column.id, row[column.id], row)
                  ) : (
                    formatCell(row[column.id])
                  )}
                </td>
              ))}
              {renderRowActions !== undefined ? (
                <td key="__actions" className="px-3 py-2">
                  <span className="flex flex-wrap gap-2">
                    {renderRowActions(row)}
                  </span>
                </td>
              ) : null}
              {renderRowMenu !== undefined ? (
                <td key="__menu" className="px-3 py-2">
                  <RowMenu>{renderRowMenu(row)}</RowMenu>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}

function RowMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      )
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 136;
    const gap = 4;
    const left = Math.max(
      8,
      Math.min(rect.right - width, window.innerWidth - width - 8),
    );
    const top =
      rect.bottom + 180 > window.innerHeight
        ? Math.max(8, rect.top - 180 - gap)
        : rect.bottom + gap;
    setPosition({ top, left });
    setOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="dsui-data-table-menu-trigger"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        ⋯
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="dsui-data-table-menu-popover"
              role="menu"
              style={{ top: position.top, left: position.left }}
              onClick={() => setOpen(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ")
                  setOpen(false);
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
