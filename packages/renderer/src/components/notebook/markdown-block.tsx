import { type ReactNode, useEffect, useRef, useState } from "react";
import { BlockHeader } from "./block-header";

export function MarkdownBlock({
  content,
  index,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  content: string;
  index: number;
  onChange: (value: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [value, setValue] = useState(content);
  const [editing, setEditing] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) editor.current?.focus();
  }, [editing]);

  return (
    <article className="notebook-block notebook-markdown-block">
      <BlockHeader
        index={index}
        label="Markdown"
        icon="file"
        onDelete={onDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />
      {editing ? (
        <textarea
          ref={editor}
          className="notebook-markdown-editor"
          value={value}
          aria-label="Edit Markdown block"
          onChange={(event) => {
            setValue(event.target.value);
            onChange(event.target.value);
          }}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <button
          type="button"
          className="notebook-markdown"
          title="Click to edit Markdown"
          onClick={() => setEditing(true)}
        >
          <MarkdownPreview value={value} />
        </button>
      )}
    </article>
  );
}

type MarkdownBlockNode =
  | { kind: "heading"; level: number; value: string }
  | { kind: "paragraph"; value: string }
  | {
      kind: "list";
      ordered: boolean;
      items: { value: string; checked?: boolean }[];
    }
  | { kind: "quote"; value: string }
  | { kind: "code"; language: string; value: string }
  | { kind: "rule" }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "alert"; level: string; value: string };

function MarkdownPreview({ value }: { value: string }) {
  return (
    <div className="notebook-markdown-content">
      {parseMarkdown(value).map((block, index) => {
        const key = `${block.kind}:${index}`;
        if (block.kind === "heading") {
          const Heading = `h${block.level}` as "h1" | "h2" | "h3" | "h4";
          return <Heading key={key}>{renderInline(block.value)}</Heading>;
        }
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={key}>
              {block.items.map((item) => (
                <li key={`${key}:${item.value}`}>
                  {item.checked !== undefined ? (
                    <input type="checkbox" checked={item.checked} readOnly />
                  ) : null}
                  {renderInline(item.value)}
                </li>
              ))}
            </List>
          );
        }
        if (block.kind === "quote")
          return <blockquote key={key}>{renderInline(block.value)}</blockquote>;
        if (block.kind === "alert")
          return (
            <aside
              key={key}
              className={`notebook-alert notebook-alert-${block.level.toLowerCase()}`}
            >
              <strong>{block.level}</strong>
              <div>{renderInline(block.value)}</div>
            </aside>
          );
        if (block.kind === "rule") return <hr key={key} />;
        if (block.kind === "table")
          return (
            <div key={key} className="notebook-markdown-table-wrap">
              <table className="notebook-markdown-table">
                <thead>
                  <tr>
                    {block.headers.map((header) => (
                      <th key={header}>{renderInline(header)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row) => (
                    <tr key={row.join("|")}>
                      {row.map((cell) => (
                        <td key={cell}>{renderInline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        if (block.kind === "code")
          return (
            <pre key={key} data-language={block.language}>
              <code>{block.value}</code>
            </pre>
          );
        return <p key={key}>{renderInline(block.value)}</p>;
      })}
    </div>
  );
}

function parseMarkdown(value: string): MarkdownBlockNode[] {
  const blocks: MarkdownBlockNode[] = [];
  const lines = value.split("\n");
  let paragraph: string[] = [];
  let list:
    | { ordered: boolean; items: { value: string; checked?: boolean }[] }
    | undefined;
  let code: { language: string; lines: string[] } | undefined;
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", value: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ kind: "list", ...list });
      list = undefined;
    }
  };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (code) {
      if (line.trim().startsWith("```")) {
        blocks.push({
          kind: "code",
          language: code.language,
          value: code.lines.join("\n"),
        });
        code = undefined;
      } else code.lines.push(line);
      continue;
    }
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      flushParagraph();
      flushList();
      code = { language: fence[1].trim() || "text", lines: [] };
      continue;
    }
    if (/^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "rule" });
      continue;
    }
    if (
      line.includes("|") &&
      lineIndex + 1 < lines.length &&
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(
        lines[lineIndex + 1],
      )
    ) {
      flushParagraph();
      flushList();
      const headers = splitTableRow(line);
      lineIndex += 1;
      const rows: string[][] = [];
      while (
        lineIndex + 1 < lines.length &&
        lines[lineIndex + 1].includes("|")
      ) {
        lineIndex += 1;
        rows.push(splitTableRow(lines[lineIndex]));
      }
      blocks.push({ kind: "table", headers, rows });
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        value: heading[2],
      });
      continue;
    }
    const item = line.match(/^\s*([-*]|\d+\.)\s+(.+)$/);
    if (item) {
      flushParagraph();
      const ordered = /\d+\./.test(item[1]);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      const task = item[2].match(/^\[([ xX])\]\s+(.+)$/);
      list.items.push(
        task
          ? { value: task[2], checked: task[1].toLowerCase() === "x" }
          : { value: item[2] },
      );
      continue;
    }
    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      const alert = line.match(
        /^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i,
      );
      if (alert) {
        const alertLines: string[] = [];
        while (
          lineIndex + 1 < lines.length &&
          lines[lineIndex + 1].startsWith("> ")
        ) {
          lineIndex += 1;
          alertLines.push(lines[lineIndex].slice(2));
        }
        blocks.push({
          kind: "alert",
          level: alert[1].toUpperCase(),
          value: alertLines.join(" "),
        });
      } else blocks.push({ kind: "quote", value: line.slice(2) });
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  if (code)
    blocks.push({
      kind: "code",
      language: code.language,
      value: code.lines.join("\n"),
    });
  return blocks;
}

function splitTableRow(value: string): string[] {
  return value
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderInline(value: string): ReactNode[] {
  const tokens = value.split(
    /(\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|`[^`]+`|!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\))/g,
  );
  const occurrences = new Map<string, number>();
  return tokens.map((token) => {
    const occurrence = occurrences.get(token) ?? 0;
    occurrences.set(token, occurrence + 1);
    const key = `${token}:${occurrence}`;
    if (token.startsWith("**") && token.endsWith("**"))
      return <strong key={key}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("*") && token.endsWith("*"))
      return <em key={key}>{token.slice(1, -1)}</em>;
    if (token.startsWith("~~") && token.endsWith("~~"))
      return <del key={key}>{token.slice(2, -2)}</del>;
    if (token.startsWith("`") && token.endsWith("`"))
      return <code key={key}>{token.slice(1, -1)}</code>;
    const link = token.match(/^\[([^\]]+)\]\(([^)]*)\)$/);
    if (link)
      return (
        <a key={key} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    const image = token.match(/^!\[([^\]]*)\]\(([^)]*)\)$/);
    if (image)
      return <img key={key} src={image[2]} alt={image[1]} loading="lazy" />;
    return token;
  });
}
