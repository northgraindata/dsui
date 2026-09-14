import type {
  ActionReference,
  PageNode,
} from "@northgraindata/dsui-adapter-sdk";
import { Button } from "@northgraindata/dsui-ui";
import { useEffect, useRef, useState } from "react";
import type { RegistryViewProps } from "../../registry/view-registry";
import { WorkbenchIcon } from "../icons";
import { parseQueryResult } from "../query-editor/query-result";
import { CodeBlock } from "./code-block";
import { EditableText } from "./editable-text";
import { MarkdownBlock } from "./markdown-block";
import type { NotebookBlockDocument, NotebookDocument } from "./types";

export function NotebookView({ client, node }: RegistryViewProps) {
  const notebook =
    node.kind === "notebook"
      ? (node as PageNode<"notebook", NotebookDocument>)
      : null;
  const [blocks, setBlocks] = useState<NotebookBlockDocument[]>(() =>
    notebook ? [...notebook.props.blocks] : [],
  );
  const [title, setTitle] = useState(notebook?.props.title ?? "");
  const [description, setDescription] = useState(
    notebook?.props.description ?? "",
  );
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<
    "saved" | "saving" | "unsaved" | "error"
  >("saved");
  const [message, setMessage] = useState<string>();
  const [openTabIds, setOpenTabIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(
          window.sessionStorage.getItem("dsui:notebook-tabs") ?? "null",
        );
        if (
          Array.isArray(stored) &&
          stored.every((item) => typeof item === "string")
        )
          return stored;
      } catch {
        // Use the server-provided tabs when session storage is unavailable.
      }
    }
    return (
      notebook?.props.openTabs?.map((item) => item.id) ??
      (notebook?.props.id ? [notebook.props.id] : [])
    );
  });
  const initialRender = useRef(true);
  const readOnly =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mode") === "readonly";
  useEffect(() => {
    const id = notebook?.props.id;
    if (!id) return;
    setOpenTabIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }, [notebook?.props.id]);
  useEffect(() => {
    if (typeof window !== "undefined")
      window.sessionStorage.setItem(
        "dsui:notebook-tabs",
        JSON.stringify(openTabIds),
      );
  }, [openTabIds]);
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    if (readOnly || !notebook?.props.id || !notebook.props.actions?.save)
      return;
    setSaveState("unsaved");
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const result = await client.executeAction({
          ...actionReference(
            notebook.props.actions?.save as ActionReference | string,
          ),
          input: { id: notebook.props.id, title, description, blocks },
        });
        if (result.status !== "success")
          throw new Error(result.message ?? "Notebook action failed");
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    title,
    description,
    blocks,
    notebook?.props.id,
    notebook?.props.actions?.save,
    readOnly,
    client,
  ]);

  if (!notebook) return null;
  const openTabs = openTabIds
    .map((id) => notebook.props.notebooks?.find((item) => item.id === id))
    .filter((item): item is { id: string; title: string } => Boolean(item));

  const runAction = async (
    action: ActionReference | string | undefined,
    input: unknown,
  ) => {
    if (!action || busy) return undefined;
    setBusy(true);
    try {
      const result = await client.executeAction({
        ...actionReference(action),
        input,
      });
      if (result.status !== "success")
        throw new Error(result.message ?? "Notebook action failed");
      return result.data;
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Notebook action failed",
      );
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  const save = async (overrides: { description?: string } = {}) => {
    if (readOnly || !notebook.props.id) return;
    setSaveState("saving");
    const result = await runAction(notebook.props.actions?.save, {
      id: notebook.props.id,
      title,
      description: overrides.description ?? description,
      blocks,
    });
    if (result !== undefined) {
      setSaveState("saved");
    } else setSaveState("error");
  };
  const select = async (id: string) => {
    setOpenTabIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    const result = await runAction(notebook.props.actions?.select, { id });
    if (result !== undefined)
      client.navigate(`/notebooks/${encodeURIComponent(id)}`);
  };
  const closeTab = async (id: string) => {
    setOpenTabIds((ids) => ids.filter((item) => item !== id));
    const result = await runAction(notebook.props.actions?.close, { id });
    if (!result || typeof result !== "object" || !("id" in result)) return;
    const nextId = result.id;
    if (id !== notebook.props.id) return;
    client.navigate(
      typeof nextId === "string" && nextId
        ? `/notebooks/${encodeURIComponent(nextId)}`
        : "/notebooks",
    );
  };
  const create = async () => {
    const result = await runAction(notebook.props.actions?.create, {});
    if (result && typeof result === "object" && "id" in result)
      client.navigate(`/notebooks/${encodeURIComponent(String(result.id))}`);
  };
  const duplicate = async () => {
    if (!notebook.props.id) return;
    const result = await runAction(notebook.props.actions?.duplicate, {
      id: notebook.props.id,
    });
    if (result && typeof result === "object" && "id" in result)
      client.navigate(`/notebooks/${encodeURIComponent(String(result.id))}`);
  };
  const remove = async () => {
    if (
      readOnly ||
      !notebook.props.id ||
      !window.confirm("Delete this notebook?")
    )
      return;
    const result = await runAction(notebook.props.actions?.delete, {
      id: notebook.props.id,
    });
    if (result !== undefined) client.navigate("/notebooks");
  };
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?mode=readonly`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Read-only share link copied");
    } catch {
      setMessage(url);
    }
  };
  const exportNotebook = () => {
    const payload = {
      cells: blocks.map((block) => ({
        cell_type: block.kind,
        metadata: {},
        source: block.content.split("\n").map((line) => `${line}\n`),
        ...(block.kind === "code"
          ? { outputs: [], execution_count: null }
          : {}),
      })),
      metadata: {
        kernelspec: { display_name: "DuckDB", language: "sql", name: "duckdb" },
      },
      nbformat: 4,
      nbformat_minor: 5,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title || "notebook"}.ipynb`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const importFile = async (file: File) => {
    try {
      const input = JSON.parse(await file.text()) as {
        cells?: { cell_type?: string; source?: string | string[] }[];
      };
      const importedBlocks = (input.cells ?? []).flatMap(
        (cell, index): NotebookBlockDocument[] => {
          const content = Array.isArray(cell.source)
            ? cell.source.join("")
            : (cell.source ?? "");
          if (cell.cell_type === "markdown")
            return [{ id: `markdown-${index}`, kind: "markdown", content }];
          if (cell.cell_type === "code")
            return [
              {
                id: `code-${index}`,
                kind: "code",
                language: "sql",
                content,
                action: "run-query",
              },
            ];
          return [];
        },
      );
      const result = await runAction(notebook.props.actions?.import, {
        title: file.name.replace(/\.ipynb$/i, "") || "Imported notebook",
        description: "",
        blocks: importedBlocks,
      });
      if (result && typeof result === "object" && "id" in result)
        client.navigate(`/notebooks/${encodeURIComponent(String(result.id))}`);
    } catch {
      setMessage("Could not import this .ipynb file");
    }
  };
  const runAll = async () => {
    if (busy) return;
    setMessage(undefined);
    for (const block of blocks) {
      if (block.kind !== "code" || !block.content.trim()) continue;
      const result = await runAction(block.action, { sql: block.content });
      if (result === undefined) return;
      try {
        const parsed = parseQueryResult(result);
        setBlocks((items) =>
          items.map((item) =>
            item.id === block.id && item.kind === "code"
              ? { ...item, result: parsed }
              : item,
          ),
        );
      } catch {
        setMessage("Query returned an invalid result");
        return;
      }
    }
  };
  const updateBlock = (id: string, content: string) =>
    setBlocks((items) =>
      items.map((item) => (item.id === id ? { ...item, content } : item)),
    );
  const deleteBlock = (id: string) =>
    setBlocks((items) => items.filter((item) => item.id !== id));
  const moveBlock = (id: string, direction: -1 | 1) =>
    setBlocks((items) => {
      const index = items.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;
      const next = [...items];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  const addBlock = (kind: "markdown" | "code") => {
    const id = `${kind}-${Date.now()}`;
    setBlocks((items) => [
      ...items,
      kind === "markdown"
        ? {
            id,
            kind,
            content: "## New note\n\nClick to edit this Markdown block.",
          }
        : {
            id,
            kind,
            language: "sql",
            content: "SELECT 1 AS example;",
            action: "run-query",
          },
    ]);
    setAddMenuOpen(false);
  };

  return (
    <section className="notebook-workspace" aria-label="Notebook">
      {openTabs.length ? (
        <nav className="notebook-tabs" aria-label="Open notebooks">
          {openTabs.map((tab) => (
            <div
              className="notebook-tab"
              data-active={tab.id === notebook.props.id ? "true" : undefined}
              key={tab.id}
            >
              <button
                type="button"
                onClick={() => void select(tab.id)}
                disabled={busy}
              >
                {tab.id === notebook.props.id ? title : tab.title}
              </button>
              {!readOnly && (
                <button
                  type="button"
                  className="notebook-tab-close"
                  aria-label={`Close ${tab.title}`}
                  onClick={() => void closeTab(tab.id)}
                  disabled={busy}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </nav>
      ) : null}
      <header className="notebook-header">
        <div className="notebook-title-editor">
          <div className="notebook-title-row">
            <EditableText
              value={title}
              onChange={setTitle}
              readOnly={readOnly}
              className="notebook-title-input"
            />
            {!readOnly && (
              <span
                className="notebook-title-edit-hint"
                title="Click the title to edit"
              >
                <WorkbenchIcon name="edit" size={13} />
              </span>
            )}
          </div>
          <EditableText
            value={description}
            onChange={setDescription}
            onCommit={(value) => void save({ description: value })}
            readOnly={readOnly}
            multiline
            className="notebook-description-input"
          />
        </div>
        <fieldset className="notebook-toolbar" aria-label="Notebook actions">
          {!readOnly && (
            <Button type="button" onClick={() => void save()} disabled={busy}>
              {saveState === "saving" ? "Saving…" : "Save"}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => void runAll()}
            disabled={busy}
          >
            Run all
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void share()}
          >
            Share
          </Button>
          <Button type="button" variant="secondary" onClick={exportNotebook}>
            Export
          </Button>
          {!readOnly && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void duplicate()}
                disabled={busy}
              >
                Duplicate
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void create()}
                disabled={busy}
              >
                New notebook
              </Button>
              {notebook.props.id && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void remove()}
                  disabled={busy}
                >
                  Delete
                </Button>
              )}
            </>
          )}
          {!readOnly && (
            <label className="notebook-import-button">
              Import .ipynb
              <input
                type="file"
                accept=".ipynb,application/json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file);
                  event.target.value = "";
                }}
              />
            </label>
          )}
        </fieldset>
      </header>
      {notebook.props.notebooks?.length ? (
        <aside className="notebook-catalog" aria-label="Notebook catalog">
          <div className="notebook-catalog-header">
            <strong>Notebook catalog</strong>
            <span>{notebook.props.notebooks.length}</span>
          </div>
          <nav className="notebook-list" aria-label="Notebooks">
            {notebook.props.notebooks.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-current={
                  item.id === notebook.props.id ? "page" : undefined
                }
                onClick={() => void select(item.id)}
                disabled={busy}
              >
                {item.id === notebook.props.id ? title : item.title}
              </button>
            ))}
          </nav>
        </aside>
      ) : null}
      {message ? (
        <p role="status" className="notebook-status">
          {message}
        </p>
      ) : null}
      <div className="notebook-blocks">
        {blocks.map((block, index) => (
          <NotebookBlock
            key={block.id}
            client={client}
            block={block}
            index={index}
            readOnly={readOnly}
            onChange={(content) => updateBlock(block.id, content)}
            onResult={(result) =>
              setBlocks((items) =>
                items.map((item) =>
                  item.id === block.id && item.kind === "code"
                    ? { ...item, result }
                    : item,
                ),
              )
            }
            onDelete={() => deleteBlock(block.id)}
            onMoveUp={() => moveBlock(block.id, -1)}
            onMoveDown={() => moveBlock(block.id, 1)}
            canMoveUp={index > 0}
            canMoveDown={index < blocks.length - 1}
          />
        ))}
      </div>
      {!readOnly && (
        <div className="notebook-add-block">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setAddMenuOpen((value) => !value)}
          >
            + Add block
          </Button>
          {addMenuOpen && (
            <div className="notebook-add-menu">
              <button type="button" onClick={() => addBlock("markdown")}>
                Markdown
              </button>
              <button type="button" onClick={() => addBlock("code")}>
                SQL
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function actionReference(value: ActionReference | string): ActionReference {
  return typeof value === "string"
    ? { actionId: value }
    : { actionId: value.actionId };
}
function NotebookBlock({
  client,
  block,
  index,
  readOnly,
  onChange,
  onResult,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  client: RegistryViewProps["client"];
  block: NotebookBlockDocument;
  index: number;
  readOnly: boolean;
  onChange: (content: string) => void;
  onResult: (result: ReturnType<typeof parseQueryResult> | undefined) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  if (block.kind === "markdown")
    return (
      <MarkdownBlock
        content={block.content}
        index={index}
        readOnly={readOnly}
        onChange={onChange}
        onDelete={onDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />
    );
  return (
    <CodeBlock
      client={client}
      action={block.action}
      content={block.content}
      index={index}
      language={block.language}
      initialResult={block.result}
      onResult={onResult}
      readOnly={readOnly}
      onChange={onChange}
      onDelete={onDelete}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
    />
  );
}
