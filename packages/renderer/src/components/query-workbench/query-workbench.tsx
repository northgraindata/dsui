import { Button } from "@northgraindata/dsui-ui";
import { useCallback, useRef, useState } from "react";
import { type RegistryViewProps, registerView } from "../../registry";
import { WorkbenchIcon } from "../icons";
import { parseQueryResult, type QueryResultView } from "./query-result";
import { QueryResults } from "./results";
import { SqlEditor } from "./sql-editor";

export function selectFromRelation(labels: string[]): string {
  return (
    "SELECT *\nFROM " +
    labels.map((label) => `"${label.replaceAll('"', '""')}"`).join(".") +
    "\nLIMIT 100;"
  );
}
type QueryTab = {
  id: number;
  sql: string;
  result?: QueryResultView;
  error?: string;
  running: boolean;
};
export function QueryWorkbench({ client, node }: RegistryViewProps) {
  const initialSql =
    node.kind === "query-workbench" ? (node.props.value ?? "") : "";
  const action =
    node.kind === "query-workbench" ? node.props.action : undefined;
  const sequence = useRef(1);
  const inFlight = useRef(new Set<number>());
  const [tabs, setTabs] = useState<QueryTab[]>([
    { id: 1, sql: initialSql, running: false },
  ]);
  const [activeId, setActiveId] = useState(1);
  const tab = tabs.find((item) => item.id === activeId) ?? tabs[0];
  const updateTab = useCallback((id: number, change: Partial<QueryTab>) => {
    setTabs((items) =>
      items.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );
  }, []);
  const setSql = useCallback(
    (sql: string) => updateTab(activeId, { sql }),
    [activeId, updateTab],
  );
  const run = useCallback(async () => {
    if (!action || !tab?.sql.trim() || inFlight.current.has(tab.id)) return;
    const id = tab.id;
    inFlight.current.add(id);
    updateTab(id, { running: true, error: undefined, result: undefined });
    const started = performance.now();
    try {
      const response = await client.executeAction({
        ...action,
        input: { sql: tab.sql },
      });
      if (response.status !== "success")
        throw new Error(response.message ?? "Query failed");
      const result = parseQueryResult(response.data);
      updateTab(id, {
        result: {
          ...result,
          elapsedMs: result.elapsedMs ?? performance.now() - started,
        },
      });
    } catch (cause) {
      updateTab(id, {
        error: cause instanceof Error ? cause.message : "Query failed",
      });
    } finally {
      inFlight.current.delete(id);
      updateTab(id, { running: false });
    }
  }, [client, action, tab, updateTab]);
  if (node.kind !== "query-workbench") return null;
  if (!tab) return null;
  return (
    <section className="query-workspace" aria-label="Query workspace">
      <div className="query-editor-panel">
        <div className="query-editor-toolbar">
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
                  onClick={() => setActiveId(item.id)}
                >
                  Query {item.id}
                </button>
                <button
                  type="button"
                  aria-label={`Close Query ${item.id}`}
                  disabled={tabs.length === 1 || item.running}
                  onClick={() => {
                    const remaining = tabs.filter(
                      (entry) => entry.id !== item.id,
                    );
                    setTabs(remaining);
                    if (activeId === item.id && remaining[0])
                      setActiveId(remaining[0].id);
                  }}
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
              title={
                tabs.length >= 8 ? "Maximum of 8 open queries" : "New query"
              }
              onClick={() => {
                const id = ++sequence.current;
                setTabs((items) => [...items, { id, sql: "", running: false }]);
                setActiveId(id);
              }}
            >
              <WorkbenchIcon name="plus" />
            </button>
          </div>
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
              onClick={run}
              disabled={tab.running || !tab.sql.trim()}
            >
              <WorkbenchIcon name="play" size={14} />
              {tab.running ? "Running…" : "Run"}
              <span aria-hidden="true">⌘ ↵</span>
            </Button>
          </div>
        </div>
        <SqlEditor
          value={tab.sql}
          onChange={setSql}
          onRun={run}
          placeholder={`Write ${node.props.language.toUpperCase()}…`}
        />
      </div>
      <QueryResults
        result={tab.result}
        error={tab.error}
        running={tab.running}
      />
    </section>
  );
}

registerView("query-workbench", QueryWorkbench);
