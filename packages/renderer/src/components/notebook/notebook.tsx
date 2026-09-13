import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import { Button } from "@northgraindata/dsui-ui";
import { useState } from "react";
import type { RegistryViewProps } from "../../registry/view-registry";
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
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [title, setTitle] = useState(notebook?.props.title ?? "");
  const [description, setDescription] = useState(
    notebook?.props.description ?? "",
  );
  if (!notebook) return null;

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
      <header className="notebook-header">
        <div className="notebook-title-editor">
          <p className="notebook-eyebrow">Notebook</p>
          <EditableText
            value={title}
            onChange={setTitle}
            className="notebook-title-input"
          />
          <EditableText
            value={description}
            onChange={setDescription}
            multiline
            className="notebook-description-input"
          />
        </div>
      </header>
      <div className="notebook-blocks">
        {blocks.map((block, index) => (
          <NotebookBlock
            key={block.id}
            client={client}
            block={block}
            index={index}
            onChange={(content) => updateBlock(block.id, content)}
            onDelete={() => deleteBlock(block.id)}
            onMoveUp={() => moveBlock(block.id, -1)}
            onMoveDown={() => moveBlock(block.id, 1)}
            canMoveUp={index > 0}
            canMoveDown={index < blocks.length - 1}
          />
        ))}
      </div>
      <div className="notebook-add-block">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setAddMenuOpen((value) => !value)}
        >
          + Add block
        </Button>
        {addMenuOpen ? (
          <div className="notebook-add-menu">
            <button type="button" onClick={() => addBlock("markdown")}>
              Markdown
            </button>
            <button type="button" onClick={() => addBlock("code")}>
              SQL
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function NotebookBlock({
  client,
  block,
  index,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  client: RegistryViewProps["client"];
  block: NotebookBlockDocument;
  index: number;
  onChange: (content: string) => void;
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
      onChange={onChange}
      onDelete={onDelete}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
    />
  );
}
