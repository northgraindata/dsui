import { useState } from "react";
import { WorkbenchIcon } from "../icons";

export function BlockHeader({
  index,
  label,
  icon,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  index: number;
  label: string;
  icon: string;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="notebook-block-header">
      <span className="notebook-block-number">{index + 1}</span>
      <WorkbenchIcon name={icon} size={14} />
      <span>{label}</span>
      <div className="notebook-block-actions">
        <button
          type="button"
          aria-label={`Block ${index + 1} options`}
          className="notebook-block-menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          ···
        </button>
        {open ? (
          <div className="notebook-block-menu-popover">
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => {
                onMoveUp();
                setOpen(false);
              }}
            >
              Move up
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => {
                onMoveDown();
                setOpen(false);
              }}
            >
              Move down
            </button>
            <button
              type="button"
              className="notebook-delete-action"
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
            >
              Delete block
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
