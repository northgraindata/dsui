import { type MouseEvent, useCallback } from "react";
import { WorkbenchIcon } from "../icons";

export interface QueryTabSummary {
  id: number;
  running: boolean;
}

export function QueryTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
}: {
  tabs: readonly QueryTabSummary[];
  activeId: number;
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
  onNew: () => void;
}) {
  const close = useCallback(
    (event: MouseEvent, id: number) => {
      event.stopPropagation();
      onClose(id);
    },
    [onClose],
  );
  return (
    <div className="query-document-tabs">
      {tabs.map((item) => (
        <div
          className="query-document-tab"
          data-active={item.id === activeId}
          key={item.id}
        >
          <button
            type="button"
            aria-pressed={item.id === activeId}
            onClick={() => onSelect(item.id)}
          >
            Query {item.id}
          </button>
          <button
            type="button"
            aria-label={`Close Query ${item.id}`}
            disabled={tabs.length === 1 || item.running}
            onClick={(event) => close(event, item.id)}
          >
            <WorkbenchIcon name="close" size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="query-add-tab"
        aria-label="New query"
        disabled={tabs.length >= 8}
        title={tabs.length >= 8 ? "Maximum of 8 open queries" : "New query"}
        onClick={onNew}
      >
        <WorkbenchIcon name="plus" />
      </button>
    </div>
  );
}
