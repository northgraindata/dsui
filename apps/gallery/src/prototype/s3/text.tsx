/* Highlighting for previews. Python uses the SDK's own highlighter. */
import type { ReactNode } from "react";
import { highlightCode } from "../../../../../packages/adapter-sdk/src/components/ui/code-block";

function paint(
  source: string,
  pattern: RegExp,
  kind: (token: string, rest: string) => string,
): ReactNode[] {
  const out: ReactNode[] = [];
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) out.push(source.slice(cursor, start));
    out.push(
      <span
        className={`dsui-code-${kind(match[0], source.slice(start + match[0].length))}`}
        key={start}
      >
        {match[0]}
      </span>,
    );
    cursor = start + match[0].length;
  }
  out.push(source.slice(cursor));
  return out;
}

const general =
  /(--[^\n]*|#[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\b(?:SELECT|FROM|WHERE|AND|OR|AS|GROUP|ORDER|BY|DESC|ASC|INTERVAL|JOIN|LEFT|ON|set|echo|aws|true|false|null)\b|\b\d+(?:\.\d+)?\b|^\s*[A-Za-z_][\w-]*(?=:))/gm;

export function highlight(source: string, name: string): ReactNode {
  if (name.endsWith(".py")) return highlightCode(source, "python");
  if (name.endsWith(".json"))
    return paint(
      source,
      /"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b/g,
      (token, rest) =>
        token.startsWith('"')
          ? /^\s*:/.test(rest)
            ? "keyword"
            : "string"
          : "number",
    );
  const yaml = /\.ya?ml$/.test(name);
  return paint(source, general, (token) => {
    if (token.startsWith("#") || (token.startsWith("--") && !yaml))
      return "comment";
    if (token.startsWith('"') || token.startsWith("'")) return "string";
    if (/^\d/.test(token)) return "number";
    return "keyword";
  });
}

export function Source({ text, name }: { text: string; name: string }) {
  const lines = text.replace(/\n$/, "").split("\n").length;
  return (
    <div className="ax-code s3-source" data-dsui-scroll>
      <pre className="ax-code-numbers" aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => index + 1).join("\n")}
      </pre>
      <pre className="ax-code-source">
        <code>{highlight(text.replace(/\n$/, ""), name)}</code>
      </pre>
    </div>
  );
}

/** Enough Markdown for a README: headings, lists, code, bold. No raw HTML. */
export function Markdown({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/).map((part, index) =>
      // biome-ignore lint/suspicious/noArrayIndexKey: fixed text
      part.startsWith("**") ? (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed text
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
  const blocks = text.split(/```/);
  return (
    <div className="s3-markdown">
      {blocks.map((block, index) =>
        index % 2 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed text
          <pre key={index}>{block.trim()}</pre>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed text
          <div key={index}>
            {block
              .trim()
              .split(/\n{2,}/)
              .map((part) => {
                if (part.startsWith("## "))
                  return <h3 key={part}>{part.slice(3)}</h3>;
                if (part.startsWith("# "))
                  return <h2 key={part}>{part.slice(2)}</h2>;
                if (part.startsWith("- "))
                  return (
                    <ul key={part}>
                      {part.split("\n").map((line) => (
                        <li key={line}>{inline(line.slice(2))}</li>
                      ))}
                    </ul>
                  );
                return <p key={part}>{inline(part)}</p>;
              })}
          </div>
        ),
      )}
    </div>
  );
}
