import type { SortedResult } from "fumadocs-core/search";
import { useDocsSearch } from "fumadocs-core/search/client";
import { staticClient } from "fumadocs-core/search/client/orama-static";
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Renders a search snippet. Fumadocs returns Markdown with `<mark>` around
 * matches; this keeps the marks and inline code and drops other syntax, and
 * never injects HTML.
 */
function Snippet({ text }: { text: string }) {
  const plain = (value: string) =>
    value
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\*\*|__/g, "")
      .replace(/\\([\\`*_[\]()])/g, "$1");
  /** Splits text and keys each part by its offset, which is stable. */
  const split = (value: string, pattern: RegExp) => {
    let offset = 0;
    return value
      .split(pattern)
      .filter(Boolean)
      .map((part) => {
        const key = offset;
        offset += part.length;
        return { key, part };
      });
  };
  const withCode = (value: string, prefix: string): ReactNode[] =>
    split(plain(value), /(`[^`]+`)/).map(({ key, part }) =>
      part.length > 1 && part.startsWith("`") && part.endsWith("`") ? (
        <code key={`${prefix}${key}`}>{part.slice(1, -1)}</code>
      ) : (
        <Fragment key={`${prefix}${key}`}>{part}</Fragment>
      ),
    );
  return (
    <>
      {split(text, /(<mark>[\s\S]*?<\/mark>)/).map(({ key, part }) =>
        part.startsWith("<mark>") ? (
          <mark key={key}>
            {withCode(part.slice(6, -7).replace(/`/g, ""), `m${key}-`)}
          </mark>
        ) : (
          <Fragment key={key}>{withCode(part, `t${key}-`)}</Fragment>
        ),
      )}
    </>
  );
}

const stripMarks = (value: string) => value.replace(/<\/?mark>/g, "");

/** A page result names the page; heading and text results sit under it. */
function ResultLabel({ result }: { result: SortedResult }) {
  if (result.type === "page") {
    return (
      <>
        {result.breadcrumbs && result.breadcrumbs.length > 0 && (
          <small>{result.breadcrumbs.map(stripMarks).join(" / ")}</small>
        )}
        <span className="search-result-title">
          <Snippet text={result.content} />
        </span>
      </>
    );
  }
  return (
    <span className="search-result-text">
      {result.type === "heading" && (
        <span className="search-result-hash" aria-hidden="true">
          #
        </span>
      )}
      <span>
        <Snippet text={result.content} />
      </span>
    </span>
  );
}

/** Opens search on Cmd K or Ctrl K, and on the header button's event. */
function useSearchShortcut(open: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("docs:search", open);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("docs:search", open);
    };
  }, [open]);
}

export default function Search({ base }: { base: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const { search, setSearch, query } = useDocsSearch({
    client: staticClient({ from: `${base}/api/search` }),
  });
  const results = query.data === "empty" || !query.data ? [] : query.data;

  const open = useCallback(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  useSearchShortcut(open);

  useEffect(() => {
    list.current
      ?.querySelector(`#search-result-${selected}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const onInputKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const url = results[selected]?.url;
      if (url) window.location.href = url;
    }
  };

  return (
    <dialog
      ref={dialog}
      className="search-dialog"
      aria-label="Search documentation"
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current?.close();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") dialog.current?.close();
      }}
    >
      <div className="search-field">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className="search-input"
          type="search"
          placeholder="Search the docs"
          aria-label="Search the docs"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="search-results"
          aria-activedescendant={
            results[selected] ? `search-result-${selected}` : undefined
          }
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setSelected(0);
          }}
          onKeyDown={onInputKey}
        />
        <kbd>Esc</kbd>
      </div>
      {search.trim() !== "" && results.length === 0 && !query.isLoading && (
        <p className="search-empty">No results for “{search}”.</p>
      )}
      {results.length > 0 && (
        <div
          className="search-results"
          id="search-results"
          role="listbox"
          ref={list}
        >
          {results.map((result, index) => (
            <div
              key={result.id}
              tabIndex={-1}
              id={`search-result-${index}`}
              role="option"
              aria-selected={index === selected}
              className="search-result"
              data-type={result.type}
            >
              <a
                href={result.url}
                tabIndex={-1}
                onMouseMove={() => setSelected(index)}
              >
                <ResultLabel result={result} />
              </a>
            </div>
          ))}
        </div>
      )}
      {results.length > 0 && (
        <p className="search-hint">
          <kbd>↑</kbd> <kbd>↓</kbd> to move, <kbd>Enter</kbd> to open
        </p>
      )}
    </dialog>
  );
}
