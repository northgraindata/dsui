import hljs from "highlight.js/lib/core";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import type * as ReactTypes from "react";
import type { z } from "zod";
import { React } from "./react";
import type { fileSchema } from "./shared";

for (const [name, language] of Object.entries({
  javascript,
  typescript,
  json,
  python,
  sql,
  xml,
  css,
  yaml,
}))
  hljs.registerLanguage(name, language);
function highlighted(text: string, language: string): ReactTypes.ReactNode {
  const document = new DOMParser().parseFromString(
    hljs.highlight(text, { language }).value,
    "text/html",
  );
  let key = 0;
  const convert = (node: Node): ReactTypes.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    const children = Array.from(node.childNodes).map(convert);
    // Only highlight spans are rendered; repository text never becomes markup.
    if (node instanceof Element && node.tagName === "SPAN")
      return (
        <span key={++key} className={node.className}>
          {children}
        </span>
      );
    return children;
  };
  return Array.from(document.body.childNodes).map(convert);
}

export function Code({ file }: { file: z.infer<typeof fileSchema> }) {
  const content = file.content ?? "";
  const lines = content
    .split("\n")
    .map((text, index) => ({ text, number: index + 1 }));
  React.useEffect(() => {
    const scroll = () => {
      const line = document.getElementById(window.location.hash.slice(1));
      line?.scrollIntoView({ block: "center" });
    };
    scroll();
    window.addEventListener("hashchange", scroll);
    return () => window.removeEventListener("hashchange", scroll);
  }, [file.path, file.version]);
  if (file.reason)
    return (
      <p>
        {file.reason} · {file.size.toLocaleString()} bytes
      </p>
    );
  const extension = file.path.split(".").at(-1) ?? "";
  const language = (
    {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      json: "json",
      py: "python",
      sql: "sql",
      html: "xml",
      xml: "xml",
      css: "css",
      yml: "yaml",
      yaml: "yaml",
    } as Record<string, string>
  )[extension];
  return (
    <div className="cr-code">
      <pre>
        {lines.map((line) => (
          <div
            className="cr-line"
            id={`L${line.number}`}
            key={`L${line.number}`}
          >
            <a href={`#L${line.number}`}>{line.number}</a>
            {language ? (
              <code>{highlighted(line.text || " ", language)}</code>
            ) : (
              <code>{line.text || " "}</code>
            )}
          </div>
        ))}
      </pre>
    </div>
  );
}
