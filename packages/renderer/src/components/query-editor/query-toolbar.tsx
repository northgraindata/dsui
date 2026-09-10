import { Button } from "@northgraindata/dsui-ui";
import { WorkbenchIcon } from "../icons";
import { type QueryTabSummary, QueryTabs } from "./query-tabs";

export function QueryToolbar({
  tabs,
  activeId,
  running,
  canRun,
  onSelect,
  onClose,
  onNew,
  onRun,
}: {
  tabs: readonly QueryTabSummary[];
  activeId: number;
  running: boolean;
  canRun: boolean;
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
  onNew: () => void;
  onRun: () => void;
}) {
  return (
    <div className="query-editor-toolbar">
      <QueryTabs
        tabs={tabs}
        activeId={activeId}
        onSelect={onSelect}
        onClose={onClose}
        onNew={onNew}
      />
      <div className="query-editor-actions">
        <Button
          variant="secondary"
          className="format-query"
          disabled
          title="SQL formatting is coming soon"
        >
          <WorkbenchIcon name="format" />
          Format
        </Button>
        <span
          className="query-save-state"
          title="Queries are kept in this page only"
        >
          <WorkbenchIcon name="check" size={13} />
          Session only
        </span>
        <Button
          className="run-query"
          onClick={onRun}
          disabled={running || !canRun}
        >
          <WorkbenchIcon name="play" size={14} />
          {running ? "Running…" : "Run"}
          <span aria-hidden="true">⌘ ↵</span>
        </Button>
      </div>
    </div>
  );
}
