import { Button } from "@northgraindata/dsui-ui";
import type { ReactNode } from "react";
import { useState } from "react";
import type { CodeBlockProps } from "../primitives/code-block";
import { type ComponentProps, componentProps } from "../runtime";

export function CodeBlock({ node, context }: ComponentProps) {
  const props = componentProps<CodeBlockProps>(node);
  const [copied, setCopied] = useState(false);
  if (!props) return null;
  const label = resolve(props.label, context) ?? "Code";
  const value = resolve(props.value, context) ?? "";
  const language = resolve(props.language, context) ?? "text";
  return (
    <div className="resource-code-block">
      <h3>{label}</h3>
      <div>
        <pre>
          <code data-language={language}>{highlightCode(value, language)}</code>
        </pre>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={`Copy ${label}`}
          onClick={() => {
            void navigator.clipboard
              .writeText(value)
              .then(() => setCopied(true));
          }}
        >
          {copied ? "✓" : "⧉"}
        </Button>
      </div>
    </div>
  );
}

function highlightCode(value: string, language: string): ReactNode {
  if (language !== "python") return value;
  const pattern =
    /(#.*$|'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|@[A-Za-z_][\w.]*|\b(?:and|as|assert|async|await|break|case|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|match|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b|\b(?:True|False|None)\b|\b\d+(?:\.\d+)?\b)/gm;
  const tokens: ReactNode[] = [];
  let cursor = 0;
  let index = 0;
  for (const match of value.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) tokens.push(value.slice(cursor, start));
    const token = match[0];
    const kind = token.startsWith("#")
      ? "comment"
      : token.startsWith("'") || token.startsWith('"')
        ? "string"
        : token.startsWith("@")
          ? "decorator"
          : /^(True|False|None)$/.test(token)
            ? "constant"
            : /^\d/.test(token)
              ? "number"
              : "keyword";
    tokens.push(
      <span className={`resource-code-${kind}`} key={`${start}-${index++}`}>
        {token}
      </span>,
    );
    cursor = start + token.length;
  }
  if (cursor < value.length) tokens.push(value.slice(cursor));
  return tokens;
}

export default CodeBlock;

function resolve(
  value: unknown,
  context: Record<string, unknown> | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || !("field" in value))
    return undefined;
  const result = String(value.field)
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[key]
          : undefined,
      context,
    );
  return result === undefined || result === null ? undefined : String(result);
}
