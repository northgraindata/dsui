import { Button } from "@northgraindata/dsui-ui";
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
          <code data-language={language}>{value}</code>
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
