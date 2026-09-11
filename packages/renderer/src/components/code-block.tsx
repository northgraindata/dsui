import { Button } from "@northgraindata/dsui-ui";
import { useState } from "react";
import type { RegistryViewProps } from "../registry/view-registry";
import { WorkbenchIcon } from "./icons";

export function CodeBlockView({ node, context }: RegistryViewProps) {
  if (node.kind !== "code-block") return null;
  const label = resolve(node.props.label, context) ?? "Code";
  const value = resolve(node.props.value, context) ?? "";
  const language = resolve(node.props.language, context) ?? "text";
  const [copied, setCopied] = useState(false);
  return (
    <div className="resource-code-block">
      <h3>{label}</h3>
      <div>
        <pre><code data-language={language}>{highlight(value, language)}</code></pre>
        <Button type="button" variant="secondary" size="icon" aria-label={`Copy ${label}`} onClick={() => {
          void navigator.clipboard.writeText(value).then(() => setCopied(true));
        }}>
          <WorkbenchIcon name={copied ? "check" : "copy"} />
        </Button>
      </div>
    </div>
  );
}

function highlight(value: string, language: string) {
  if (language !== "sql") return value;
  return value.split(/(\s+|'[^']*'|\b(?:SELECT|FROM|INSTALL|LOAD|CREATE|SECRET|TYPE|SET|AS|LIMIT|WHERE|WITH|INSERT|UPDATE|DELETE|DROP)\b)/gi).map((token, index) => {
    if (/^'[^']*'$/.test(token)) return <span className="resource-code-string" key={index}>{token}</span>;
    if (/^(SELECT|FROM|INSTALL|LOAD|CREATE|SECRET|TYPE|SET|AS|LIMIT|WHERE|WITH|INSERT|UPDATE|DELETE|DROP)$/i.test(token)) return <span className="resource-code-keyword" key={index}>{token}</span>;
    return token;
  });
}

function resolve(value: unknown, context: Record<string, unknown> | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || !("field" in value)) return undefined;
  const result = String(value.field).split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object") return (current as Record<string, unknown>)[key];
    return undefined;
  }, context);
  return result === undefined || result === null ? undefined : String(result);
}
