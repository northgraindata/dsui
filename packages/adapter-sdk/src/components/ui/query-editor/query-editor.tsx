import { OptionSelect } from "@northgraindata/dsui-ui";
import { useEffect, useRef, useState } from "react";
import type { QueryEditorProps } from "../../primitives/query-editor";
import { type ComponentProps, componentProps } from "../../runtime";
import { ResourceTree } from "../resource-tree";
import { identifierInsertion, qualifiedSqlName } from "./query-explorer";
import { QueryToolbar } from "./query-toolbar";
import { QueryResults } from "./results";
import { SqlEditor, type SqlEditorHandle } from "./sql-editor";
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
  const workspace = useQueryWorkspace(client, action, props.value ?? "");
  const editorRef = useRef<SqlEditorHandle>(null);
  const { tabs, tab, activeId, setActiveId, setSql, run, closeTab, newTab } =
    workspace;
  if (!tab) return null;
  const explorerNode = props.explorer
    ? {
        kind: "resource-tree" as const,
        props: {
          label: "Query explorer",
          branch: props.explorer,
          searchPlaceholder: "Search databases, schemas, tables…",
        },
      }
    : undefined;
  return (
    <section
      className={`query-workspace ${explorerNode ? "query-workspace--with-explorer" : ""}`}
      aria-label="Query workspace"
    >
      {explorerNode && (
        <aside className="query-workspace-explorer">
          <ResourceTree
            client={client}
            node={explorerNode}
            onItemDoubleClick={(labels) => {
              const name = qualifiedSqlName(labels, props.omitDatabaseFromSql);
              if (editorRef.current) editorRef.current.insertText(name);
              else
                setSql(
                  tab.sql +
                    identifierInsertion(
                      tab.sql,
                      tab.sql.length,
                      tab.sql.length,
                      name,
                    ),
                );
            }}
          />
        </aside>
      )}
      <div className="query-workspace-main">
        <div
          className="query-editor-panel"
          data-dsui-overlay-target="query.editor"
        >
          {props.database ? (
            <div className="query-database-picker">
              <span>{props.database.label ?? "Database"}</span>
              <OptionSelect
                ariaLabel={props.database.label ?? "Database"}
                value={database}
                placeholder="Configured database"
                options={databases.map((item) => ({
                  value: item.name,
                  label: item.name,
                }))}
                onValueChange={setDatabase}
              />
            </div>
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
          />
          <SqlEditor
            ref={editorRef}
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
      </div>
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
