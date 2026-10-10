import { useEffect, useState } from "react";
import type { QueryEditorProps } from "../../primitives/query-editor";
import { type ComponentProps, componentProps } from "../../runtime";
import { ContextSelector } from "./context-selectors";
import { QueryExplorer } from "./explorer";
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
  return <QueryEditorContent client={client} props={props} />;
}

function QueryEditorContent({
  client,
  props,
}: {
  client: ComponentProps["client"];
  props: QueryEditorProps;
}) {
  const baseAction = actionReference(props.action);
  const [selections, setSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (props.contextSelectors ?? []).map((selector) => [
        selector.name,
        selector.initialValue ?? "",
      ]),
    ),
  );
  const changeSelection = (name: string, value: string) =>
    setSelections((current) => {
      const next = { ...current, [name]: value };
      const changed = new Set([name]);
      for (const selector of props.contextSelectors ?? [])
        if (selector.dependsOn?.some((dependency) => changed.has(dependency))) {
          next[selector.name] = "";
          changed.add(selector.name);
        }
      return next;
    });
  const [databases, setDatabases] = useState<{ name: string }[]>([]);
  const [database, setDatabase] = useState(props.database?.initialValue ?? "");
  useEffect(() => {
    if (!props.database) return;
    let active = true;
    client
      .executeResource(props.database.source)
      .then((result) => {
        if (!active || !Array.isArray(result)) return;
        const options = result.filter(
          (item): item is { name: string } =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { name?: unknown }).name === "string",
        );
        setDatabases(options);
        if (!props.database?.initialValue && options.length > 0)
          setDatabase((current) => current || options[0].name);
      })
      .catch(() => {
        if (active) setDatabases([]);
      });
    return () => {
      active = false;
    };
  }, [client, props.database]);
  const action =
    database.length > 0
      ? {
          ...baseAction,
          input: {
            ...(typeof baseAction.input === "object" &&
            baseAction.input !== null
              ? baseAction.input
              : {}),
            database,
          },
        }
      : baseAction;
  const contextualAction = {
    ...action,
    input: {
      ...(typeof action.input === "object" && action.input !== null
        ? action.input
        : {}),
      ...Object.fromEntries(
        Object.entries(selections).filter(([, value]) => value.length > 0),
      ),
    },
  };
  const workspace = useQueryWorkspace(
    client,
    contextualAction,
    props.value ?? "",
  );
  const { tabs, tab, activeId, setActiveId, setSql, run, closeTab, newTab } =
    workspace;
  if (!tab) return null;
  return (
    <section className="query-workspace" aria-label="Query workspace">
      {props.explorer && (
        <aside
          aria-label="Database explorer"
          style={{
            borderBottom: "1px solid var(--color-border)",
            padding: 12,
            maxHeight: 260,
            overflow: "auto",
          }}
        >
          <details>
            <summary>Explorer</summary>
            <QueryExplorer
              client={client}
              definition={props.explorer}
              onSelect={(names) => setSql(selectFromRelation(names))}
            />
          </details>
        </aside>
      )}
      <div className="query-editor-panel">
        {props.contextSelectors?.map((selector) => (
          <ContextSelector
            key={selector.name}
            client={client}
            selector={selector}
            values={selections}
            change={changeSelection}
          />
        ))}
        {props.database ? (
          <label className="query-database-picker">
            <span>{props.database.label ?? "Database"}</span>
            <select
              value={database}
              onChange={(event) => setDatabase(event.target.value)}
            >
              <option value="">Configured database</option>
              {databases.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <QueryToolbar
          tabs={tabs}
          activeId={activeId}
          running={tab.running}
          canRun={Boolean(tab.sql.trim())}
          onSelect={setActiveId}
          onClose={closeTab}
          onNew={newTab}
          onRun={run}
          onCancel={workspace.cancel}
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
