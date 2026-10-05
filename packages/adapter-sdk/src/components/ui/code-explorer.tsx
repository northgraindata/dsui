import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type {
  CodeExplorerFile,
  CodeExplorerProps,
} from "../primitives/code-explorer";
import { type ComponentProps, componentProps } from "../runtime";
import { styles } from "./code-explorer-styles";

const contentSchema = z.object({
  content: z.string().nullish(),
  size: z.number().optional(),
  reason: z.string().nullish(),
  language: z.string().nullish(),
});
const languages: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  sql: "sql",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  html: "html",
  xml: "xml",
  css: "css",
  md: "markdown",
  sh: "shell",
  rs: "rust",
  go: "go",
  java: "java",
  rb: "ruby",
  toml: "toml",
};
function CodePreview({
  content,
  path,
  language,
}: {
  content: string;
  path: string;
  language?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  const [wrap, setWrap] = useState(false);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    setError(undefined);
    void import("modern-monaco/core")
      .then(async ({ init }) => {
        const selectedLanguage =
          language ?? languages[path.split(".").at(-1) ?? ""] ?? "plaintext";
        const monaco = await init({
          langs: selectedLanguage === "plaintext" ? [] : [selectedLanguage],
          defaultTheme: "dsui-code",
          themes: [
            {
              name: "dsui-code",
              type: "dark",
              colors: {
                "editor.background": "#080e1b",
                "editor.foreground": "#dce5f8",
                "editorLineNumber.foreground": "#657ca1",
                "editorLineNumber.activeForeground": "#b0c1df",
                "editor.selectionBackground": "#18366a",
                "editor.lineHighlightBackground": "#0b1220",
              },
              tokenColors: [
                { scope: "keyword", settings: { foreground: "#3294ff" } },
                { scope: "string", settings: { foreground: "#dbca69" } },
                { scope: "comment", settings: { foreground: "#6e85a8" } },
                {
                  scope: "constant.numeric",
                  settings: { foreground: "#a3b989" },
                },
              ],
            },
          ],
        });
        if (disposed || !container.current) return;
        const model = monaco.editor.createModel(content, selectedLanguage);
        const editor = monaco.editor.create(container.current, {
          model,
          readOnly: true,
          wordWrap: wrap ? "on" : "off",
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          lineHeight: 20,
          ariaLabel: `Contents of ${path}`,
          theme: "dsui-code",
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
          padding: { top: 16, bottom: 16 },
          lineNumbersMinChars: 4,
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
        });
        const reveal = () => {
          const match = /^#L(\d+)$/.exec(window.location.hash);
          if (!match) return;
          const line = Math.min(
            model.getLineCount(),
            Math.max(1, Number(match[1])),
          );
          editor.setSelection(
            new monaco.Selection(line, 1, line, model.getLineMaxColumn(line)),
          );
          editor.revealLineInCenter(line);
        };
        reveal();
        window.addEventListener("hashchange", reveal);
        const click = editor.onMouseDown((event) => {
          if (
            event.target.type ===
              monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS &&
            event.target.position
          )
            window.location.hash = `L${event.target.position.lineNumber}`;
        });
        cleanup = () => {
          window.removeEventListener("hashchange", reveal);
          click.dispose();
          editor.dispose();
          model.dispose();
        };
      })
      .catch((cause: unknown) => {
        if (!disposed)
          setError(
            cause instanceof Error ? cause.message : "Code preview unavailable",
          );
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [content, path, language, wrap]);
  return error ? (
    <div>
      <p role="alert">{error}</p>
      <pre>{content}</pre>
    </div>
  ) : (
    <>
      <div className="sdk-code-preview-actions">
        <button
          type="button"
          aria-pressed={wrap}
          onClick={() => setWrap(!wrap)}
        >
          Wrap lines
        </button>
        <span>Read only · Click a line number to link</span>
      </div>
      <div ref={container} style={{ height: "65vh", minHeight: 320 }} />
    </>
  );
}

function FileTree({
  files,
  prefix = "",
  path,
  navigate,
}: {
  files: readonly CodeExplorerFile[];
  prefix?: string;
  path: string;
  navigate: (path: string) => void;
}) {
  const entries = new Map<string, boolean>();
  for (const file of files) {
    if (!file.path.startsWith(prefix)) continue;
    const tail = file.path.slice(prefix.length);
    entries.set(tail.split("/")[0], tail.includes("/"));
  }
  return (
    <ul className="sdk-code-tree" style={{ paddingLeft: prefix ? 12 : 0 }}>
      {[...entries]
        .sort(
          ([a, ad], [b, bd]) => Number(bd) - Number(ad) || a.localeCompare(b),
        )
        .map(([name, directory]) => {
          const target = `${prefix}${name}`;
          return (
            <li key={target}>
              {directory ? (
                <Directory
                  files={files}
                  target={target}
                  path={path}
                  navigate={navigate}
                />
              ) : (
                <button
                  type="button"
                  aria-current={path === target ? "page" : undefined}
                  onClick={() => navigate(target)}
                >
                  <span className="sdk-code-file-icon" aria-hidden="true">
                    ◇
                  </span>
                  <span>{name}</span>
                </button>
              )}
            </li>
          );
        })}
    </ul>
  );
}
function Directory({
  files,
  target,
  path,
  navigate,
}: {
  files: readonly CodeExplorerFile[];
  target: string;
  path: string;
  navigate: (path: string) => void;
}) {
  const active = path === target || path.startsWith(`${target}/`);
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  return (
    <>
      <div className="sdk-code-directory">
        <button
          type="button"
          aria-label={`${open ? "Collapse" : "Expand"} ${target}`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="sdk-code-toggle"
        >
          {open ? "▾" : "▸"}
        </button>
        <button type="button" onClick={() => navigate(target)}>
          <span className="sdk-code-folder-icon" aria-hidden="true">
            ▱
          </span>
          <span>{target.split("/").at(-1)}</span>
        </button>
      </div>
      {open && (
        <FileTree
          files={files}
          prefix={`${target}/`}
          path={path}
          navigate={navigate}
        />
      )}
    </>
  );
}

export default function CodeExplorer({ node, client }: ComponentProps) {
  const props = componentProps<CodeExplorerProps>(node);
  const path = props?.path ?? "";
  const selected = props?.files.find((file) => file.path === path);
  const isFile = Boolean(selected);
  const [file, setFile] = useState<z.infer<typeof contentSchema>>();
  const [error, setError] = useState<string>();
  const [search, setSearch] = useState("");
  const reference = props?.file;
  const resourceId = reference?.resourceId;
  const input = JSON.stringify({
    input: reference?.input ?? {},
    version: props?.version,
  });
  useEffect(() => {
    let active = true;
    setFile(undefined);
    setError(undefined);
    if (!isFile || !resourceId) return;
    const request = z
      .object({ input: z.record(z.unknown()), version: z.string().optional() })
      .parse(JSON.parse(input));
    void client
      .executeResource({ resourceId, input: { ...request.input, path } })
      .then((data) => {
        if (active) setFile(contentSchema.parse(data));
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load file",
          );
      });
    return () => {
      active = false;
    };
  }, [client, resourceId, input, path, isFile]);
  if (!props) return null;
  const navigate = (target: string) =>
    client.navigate(
      `${props.basePath.replace(/\/$/, "")}/${target.split("/").map(encodeURIComponent).join("/")}`,
    );
  const base = selected
    ? path.slice(0, Math.max(0, path.lastIndexOf("/") + 1))
    : path
      ? `${path}/`
      : "";
  const entries = new Map<string, boolean>();
  for (const item of props.files) {
    if (!item.path.startsWith(base)) continue;
    const tail = item.path.slice(base.length);
    entries.set(tail.split("/")[0], tail.includes("/"));
  }
  const matching = props.files.filter((item) =>
    item.path.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="sdk-code-explorer">
      <style>{styles}</style>
      <header className="sdk-code-heading">
        <strong>{props.title ?? "Code explorer"}</strong>
        {props.version && (
          <small title={props.version}>
            Snapshot <code>{props.version.slice(0, 12)}</code>
          </small>
        )}
      </header>
      <nav aria-label="File breadcrumbs">
        <button type="button" onClick={() => navigate("")}>
          Files
        </button>
        {path
          .split("/")
          .filter(Boolean)
          .map((part, index, parts) => (
            <button
              type="button"
              key={parts.slice(0, index + 1).join("/")}
              onClick={() => navigate(parts.slice(0, index + 1).join("/"))}
            >
              {part}
            </button>
          ))}
      </nav>
      <div className="sdk-code-explorer-layout">
        <aside aria-label="Source files">
          <input
            aria-label="Find file"
            placeholder="Find file…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search ? (
            matching.map((item) => (
              <button
                type="button"
                key={item.path}
                onClick={() => navigate(item.path)}
              >
                {item.path}
              </button>
            ))
          ) : (
            <FileTree files={props.files} path={path} navigate={navigate} />
          )}
          {search && !matching.length && (
            <p className="sdk-code-empty">No matching files.</p>
          )}
          {!props.files.length && (
            <p>{props.emptyMessage ?? "No files available."}</p>
          )}
        </aside>
        <main>
          {error ? (
            <p role="alert" className="sdk-code-error">
              {error}
            </p>
          ) : file ? (
            <>
              <div className="sdk-code-file-heading">
                <div>
                  <strong>{path.split("/").at(-1)}</strong>
                  <span>
                    {file.content?.split("\n").length ?? "—"} lines ·{" "}
                    {file.size?.toLocaleString()} bytes
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard.writeText(file.content ?? "")
                  }
                  disabled={file.content == null}
                >
                  Copy
                </button>
              </div>
              {file.reason ? (
                <p>{file.reason}</p>
              ) : (
                <CodePreview
                  content={file.content ?? ""}
                  path={path}
                  language={file.language ?? undefined}
                />
              )}
            </>
          ) : selected ? (
            <p>Loading file…</p>
          ) : (
            <section aria-label="Directory contents">
              {base && (
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      base.replace(/\/$/, "").split("/").slice(0, -1).join("/"),
                    )
                  }
                >
                  ../
                </button>
              )}
              {[...entries]
                .sort(
                  ([a, ad], [b, bd]) =>
                    Number(bd) - Number(ad) || a.localeCompare(b),
                )
                .map(([name, directory]) => (
                  <div key={name}>
                    <button
                      type="button"
                      onClick={() => navigate(`${base}${name}`)}
                    >
                      {directory ? "▸ " : ""}
                      {name}
                      {directory ? "/" : ""}
                    </button>
                  </div>
                ))}
              {!entries.size && (
                <p>
                  {path
                    ? "File or folder not found."
                    : (props.emptyMessage ?? "No files available.")}
                </p>
              )}
            </section>
          )}
        </main>
      </div>
    </section>
  );
}
