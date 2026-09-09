import type {
  PageNode,
  QueryExplorerDocument,
  ResourceTreeBranchDocument,
} from "@northgraindata/dsui-core";
import { Button, DataTable, Surface } from "@northgraindata/dsui-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResourceTreeView } from "./ResourceTree";
import type { RendererClient } from "./types";

type QueryData = {
  elapsedMs?: unknown;
  rows?: unknown;
  rowsChanged?: unknown;
};

function queryRows(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const rows = (data as QueryData).rows;
  if (!Array.isArray(rows)) return [];
  return rows.map((row) =>
    row && typeof row === "object" && !Array.isArray(row)
      ? (row as Record<string, unknown>)
      : { value: row },
  );
}

function elapsedLabel(elapsedMs: number): string {
  return elapsedMs < 1_000
    ? `${Math.round(elapsedMs)} ms`
    : `${(elapsedMs / 1_000).toFixed(2)} s`;
}

function serverElapsedMs(data: unknown): number | undefined {
  if (!data || typeof data !== "object") return undefined;
  const elapsedMs = (data as QueryData).elapsedMs;
  return typeof elapsedMs === "number" && elapsedMs >= 0
    ? elapsedMs
    : undefined;
}

function SqlEditor({
  value,
  onChange,
  onRun,
}: {
  value: string;
  onChange(value: string): void;
  onRun(): void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const initialValue = useRef(value);
  initialValue.current = value;
  const editorRef = useRef<{
    getValue(): string;
    setValue(value: string): void;
  } | null>(null);
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let editor:
      | {
          dispose(): void;
          getValue(): string;
          setValue(value: string): void;
          onDidChangeModelContent(listener: () => void): { dispose(): void };
          addCommand(keybinding: number, handler: () => void): void;
        }
      | undefined;
    let model: { dispose(): void } | undefined;
    let subscription: { dispose(): void } | undefined;
    void import("modern-monaco/core")
      .then(async ({ init }) => {
        const monaco = await init({
          defaultTheme: "one-dark-pro",
          langs: ["sql"],
        });
        if (disposed || !element.current) return;
        const nextModel = monaco.editor.createModel(
          initialValue.current,
          "sql",
        );
        model = nextModel;
        editor = monaco.editor.create(element.current, {
          model: nextModel,
          automaticLayout: true,
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
          fontSize: 13,
          lineHeight: 21,
          lineNumbersMinChars: 3,
          minimap: { enabled: false },
          padding: { top: 12, bottom: 12 },
          scrollBeyondLastLine: false,
        });
        editorRef.current = editor;
        subscription = editor.onDidChangeModelContent(() =>
          onChange(editor?.getValue() ?? ""),
        );
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
          onRunRef.current(),
        );
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      subscription?.dispose();
      editorRef.current = null;
      editor?.dispose();
      model?.dispose();
    };
  }, [onChange]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value)
      editorRef.current.setValue(value);
  }, [value]);

  if (failed)
    return (
      <textarea
        aria-label="SQL query"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="block h-[32rem] w-full resize-y border-0 bg-canvas p-4 font-mono text-[13px] leading-relaxed text-primary outline-none md:h-[38rem]"
      />
    );
  return <div ref={element} className="h-[32rem] md:h-[38rem]" />;
}

function resourceTreeBranch(
  branch: QueryExplorerDocument,
): ResourceTreeBranchDocument {
  return {
    source: branch.source,
    ...(branch.nameField ? { nameField: branch.nameField } : {}),
    ...(!branch.children ? { typeField: "type" } : {}),
    ...(branch.children
      ? { children: resourceTreeBranch(branch.children) }
      : {}),
  };
}

export function selectFromRelation(labels: string[]): string {
  const qualifiedName = labels
    .map((label) => `"${label.replaceAll('"', '""')}"`)
    .join(".");
  return `SELECT *\nFROM ${qualifiedName}\nLIMIT 100;`;
}

export function QueryWorkbench({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "query-workbench" }>;
}) {
  const [sql, setSql] = useState(node.props.value ?? "SELECT 42 AS answer;");
  const [data, setData] = useState<unknown>();
  const [error, setError] = useState<string>();
  const [elapsedMs, setElapsedMs] = useState<number>();
  const [running, setRunning] = useState(false);
  const run = useCallback(async () => {
    if (!sql.trim() || running) return;
    setRunning(true);
    setError(undefined);
    const started = performance.now();
    try {
      const result = await client.executeAction({
        ...node.props.action,
        input: { sql },
      });
      const duration = performance.now() - started;
      if (result.status === "success") {
        setData(result.data);
        setElapsedMs(serverElapsedMs(result.data) ?? duration);
      } else {
        setElapsedMs(duration);
        setError(result.message ?? "Query failed");
      }
    } catch (cause) {
      setElapsedMs(performance.now() - started);
      setError(cause instanceof Error ? cause.message : "Query failed");
    } finally {
      setRunning(false);
    }
  }, [client, node.props.action, running, sql]);
  const rows = queryRows(data);
  const changed =
    data && typeof data === "object"
      ? (data as QueryData).rowsChanged
      : undefined;

  const editor = (
    <Surface className="overflow-hidden">
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          SQL
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[10px] text-muted sm:inline">
            ⌘↵ to run
          </span>
          <Button size="small" onClick={run} disabled={running || !sql.trim()}>
            {running ? "Running…" : "Run query"}
          </Button>
        </div>
      </div>
      <SqlEditor value={sql} onChange={setSql} onRun={run} />
    </Surface>
  );
  const output = (
    <div className="min-h-0 overflow-auto border-t border-border bg-canvas">
      {error ? (
        <Surface
          className="border border-unavailable/40 bg-unavailable/10 p-3 font-mono text-[11.5px] text-unavailable"
          role="alert"
        >
          {error}
        </Surface>
      ) : null}
      {elapsedMs !== undefined ? (
        <p
          className="m-0 px-3 py-2 font-mono text-[10.5px] text-muted"
          role="status"
        >
          {rows.length
            ? `${rows.length} row${rows.length === 1 ? "" : "s"}`
            : "Completed"}
          {changed !== undefined ? ` · ${String(changed)} changed` : ""}
          {` · ${elapsedLabel(elapsedMs)}`}
        </p>
      ) : null}
      {rows.length ? (
        <Surface className="overflow-auto">
          <DataTable
            columns={Object.keys(rows[0] ?? {}).map((id) => ({
              id,
              label: id,
            }))}
            rows={rows}
          />
        </Surface>
      ) : data && !error ? (
        <Surface className="p-5 text-[12px] text-secondary">
          Query completed without rows.
        </Surface>
      ) : null}
    </div>
  );
  return (
    <section
      className={`grid min-h-[48rem] overflow-hidden border border-border bg-canvas ${
        node.props.explorer
          ? "md:grid-cols-[15rem_minmax(0,1fr)] md:grid-rows-[minmax(38rem,1fr)_minmax(12rem,0.7fr)]"
          : "grid-rows-[minmax(38rem,1fr)_minmax(12rem,0.7fr)]"
      }`}
      aria-label="Query workspace"
    >
      {node.props.explorer ? (
        <div className="md:row-span-2">
          <ResourceTreeView
            client={client}
            node={{
              kind: "resource-tree",
              props: {
                label: "Query explorer",
                stateKey: "query-explorer",
                searchPlaceholder: "Search data…",
                branch: resourceTreeBranch(node.props.explorer),
              },
            }}
            onLeafSelect={(labels) => setSql(selectFromRelation(labels))}
          />
        </div>
      ) : null}
      <div className="min-h-0 overflow-auto">{editor}</div>
      {output}
    </section>
  );
}
