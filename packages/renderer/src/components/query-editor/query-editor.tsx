import type { RegistryViewProps } from "../../registry/view-registry";
import { QueryToolbar } from "./query-toolbar";
import { QueryResults } from "./results";
import { SqlEditor } from "./sql-editor";
import { useQueryWorkspace } from "./use-query-workspace";

export function selectFromRelation(labels: string[]): string {
  return (
    "SELECT *\nFROM " +
    labels.map((label) => `"${label.replaceAll('"', '""')}"`).join(".") +
    "\nLIMIT 100;"
  );
}
export function QueryEditorView({ client, node }: RegistryViewProps) {
  const props =
    node.kind === "query-editor"
      ? node.props
      : { action: { actionId: "" }, value: "", language: "sql" };
  const workspace = useQueryWorkspace(client, props.action, props.value ?? "");
  const { tabs, tab, activeId, setActiveId, setSql, run, closeTab, newTab } =
    workspace;
  if (node.kind !== "query-editor") return null;
  if (!tab) return null;
  return (
    <section className="query-workspace" aria-label="Query workspace">
      <div className="query-editor-panel">
        <QueryToolbar
          tabs={tabs}
          activeId={activeId}
          running={tab.running}
          canRun={Boolean(tab.sql.trim())}
          onSelect={setActiveId}
          onClose={closeTab}
          onNew={newTab}
          onRun={run}
        />
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
