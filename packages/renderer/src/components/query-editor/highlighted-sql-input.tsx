import { useRef } from "react";
import { sqlTokens } from "./sql-tokens";

export function HighlightedSqlInput({
  value,
  onChange,
  onRun,
  placeholder,
}: {
  value: string;
  onChange(value: string): void;
  onRun(): void;
  placeholder?: string;
}) {
  const highlight = useRef<HTMLPreElement>(null);
  const numbers = useRef<HTMLDivElement>(null);
  let offset = 0;
  return (
    <div className="highlighted-sql-input">
      <div className="sql-line-numbers" ref={numbers} aria-hidden="true">
        {Array.from({ length: value.split("\n").length }, (_, index) => (
          // Line numbers are positional by definition and have no component state.
          // biome-ignore lint/suspicious/noArrayIndexKey: line number is the stable identity
          <div key={`line-${index + 1}`}>{index + 1}</div>
        ))}
      </div>
      <pre ref={highlight} className="sql-highlight" aria-hidden="true">
        <code>
          {sqlTokens(value).map((token) => {
            const key = offset;
            offset += token.text.length;
            return (
              <span key={key} className={`sql-token-${token.kind}`}>
                {token.text}
              </span>
            );
          })}
          {"\n"}
        </code>
      </pre>
      <textarea
        className="sql-editor-fallback"
        aria-label="SQL query"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        wrap="off"
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (highlight.current) {
            highlight.current.scrollTop = event.currentTarget.scrollTop;
            highlight.current.scrollLeft = event.currentTarget.scrollLeft;
          }
          if (numbers.current)
            numbers.current.scrollTop = event.currentTarget.scrollTop;
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onRun();
          }
        }}
      />
    </div>
  );
}
