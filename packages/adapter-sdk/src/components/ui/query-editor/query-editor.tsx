import type { QueryEditorProps } from "../../primitives/query-editor";
import { type ComponentProps, componentProps } from "../../runtime";
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

export default function QueryEditor({ client, node }: ComponentProps) {
  if (node.kind !== "custom") return null;
  const props = componentProps<QueryEditorProps>(node);
  if (!props) return null;
  const workspace = useQueryWorkspace(
    client,
    actionReference(props.action),
    props.value ?? "",
  );
  const { tabs, tab, activeId, setActiveId, setSql, run, closeTab, newTab } =
    workspace;
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
          placeholder={`Write ${props.language.toUpperCase()}…`}
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

function actionReference(value: QueryEditorProps["action"]) {
  if (typeof value === "string") return { actionId: value };
  if (value == null)
    throw new Error("QueryEditor action must be an action id or reference");
  const candidate = value as unknown as { id?: unknown };
  if (typeof candidate.id === "string") return { actionId: candidate.id };
  if (value && typeof value === "object") {
    if ("actionId" in value && typeof value.actionId === "string")
      return value as { actionId: string; input?: unknown };
    if ("id" in value && typeof value.id === "string")
      return { actionId: value.id };
  }
  throw new Error("QueryEditor action must be an action id or reference");
}
