import type {
  ActionReference,
  PageNode,
} from "@northgraindata/dsui-adapter-sdk";
import { Button } from "@northgraindata/dsui-ui";
import { useState } from "react";
import type { RegistryViewProps } from "../../registry/view-registry";
import type { NotebookBlockDocument, NotebookCatalogItem } from "./types";

type CatalogDocument = {
  notebooks: NotebookCatalogItem[];
  actions?: {
    create?: ActionReference | string;
    import?: ActionReference | string;
  };
};

export function NotebookCatalogView({ client, node }: RegistryViewProps) {
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (node.kind !== "notebook-catalog") return null;
  const props = (node as PageNode<"notebook-catalog", CatalogDocument>).props;

  const runAction = async (
    action: ActionReference | string | undefined,
    input: unknown,
  ) => {
    if (!action || busy) return undefined;
    setBusy(true);
    try {
      const result = await client.executeAction({
        ...(typeof action === "string" ? { actionId: action } : action),
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

  const create = async () => {
    const result = await runAction(props.actions?.create, {});
    if (result && typeof result === "object" && "id" in result)
      client.navigate(`/notebooks/${encodeURIComponent(String(result.id))}`);
  };
  const importFile = async (file: File) => {
    try {
      const input = JSON.parse(await file.text()) as {
        cells?: { cell_type?: string; source?: string | string[] }[];
      };
      const blocks = (input.cells ?? []).flatMap(
        (cell, index): NotebookBlockDocument[] => {
          const content = Array.isArray(cell.source)
            ? cell.source.join("")
            : (cell.source ?? "");
          if (cell.cell_type === "markdown")
            return [
              { id: `markdown-${index}`, kind: "markdown" as const, content },
            ];
          if (cell.cell_type === "code")
            return [
              {
                id: `code-${index}`,
                kind: "code" as const,
                language: "sql",
                content,
                action: "run-query",
              },
            ];
          return [];
        },
      );
      const result = await runAction(props.actions?.import, {
        title: file.name.replace(/\.ipynb$/i, "") || "Imported notebook",
        description: "",
        blocks,
      });
      if (result && typeof result === "object" && "id" in result)
        client.navigate(`/notebooks/${encodeURIComponent(String(result.id))}`);
    } catch {
      setMessage("Could not import this .ipynb file");
    }
  };

  return (
    <section className="notebook-catalog-page" aria-label="Notebook catalog">
      <div className="notebook-catalog-toolbar">
        <div>
          <p className="notebook-eyebrow">Workspace</p>
          <h2>Notebooks</h2>
          <p>Open, create, and manage your analysis workspaces.</p>
        </div>
        <div className="notebook-catalog-actions">
          <Button type="button" onClick={() => void create()} disabled={busy}>
            New notebook
          </Button>
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
        </div>
      </div>
      {message ? (
        <p role="status" className="notebook-status">
          {message}
        </p>
      ) : null}
      <div className="notebook-catalog-grid">
        {props.notebooks.map((notebook) => (
          <article className="notebook-catalog-card" key={notebook.id}>
            <div className="notebook-catalog-card-heading">
              <h3>{notebook.title}</h3>
              <span>{notebook.environment ?? "DuckDB"}</span>
            </div>
            <p>{notebook.description || "No description yet."}</p>
            <dl>
              <div>
                <dt>Location</dt>
                <dd>{notebook.location ?? "Local workspace"}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatDate(notebook.updatedAt)}</dd>
              </div>
            </dl>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                client.navigate(`/notebooks/${encodeURIComponent(notebook.id)}`)
              }
            >
              Open notebook
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}
