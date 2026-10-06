import type { ReactNode, RefObject } from "react";
import { type MentionService, serviceMentions } from "./mentions";
import { React } from "./react";

export function HighlightedMentions({
  text,
  services,
}: {
  text: string;
  services: readonly MentionService[];
}) {
  const parts: ReactNode[] = [];
  let offset = 0;
  for (const mention of serviceMentions(text, services)) {
    if (!mention.service) continue;
    parts.push(text.slice(offset, mention.start));
    parts.push(
      <mark className="da-mention" key={mention.start}>
        {text.slice(mention.start, mention.end)}
      </mark>,
    );
    offset = mention.end;
  }
  parts.push(text.slice(offset));
  return <>{parts}</>;
}

function queryAt(text: string, caret: number) {
  const match = /(^|[\s([{])@([\p{L}\p{N}_.:-]*)$/u.exec(text.slice(0, caret));
  if (!match) return undefined;
  const tail = /^[\p{L}\p{N}_.:-]*/u.exec(text.slice(caret))?.[0] ?? "";
  return {
    start: match.index + match[1].length,
    end: caret + tail.length,
    search: match[2].toLowerCase(),
  };
}

export function MentionInput({
  value,
  onChange,
  services,
  disabled,
  inputRef,
  onSend,
}: {
  value: string;
  onChange(value: string): void;
  services: readonly MentionService[];
  disabled: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onSend(): void;
}) {
  const { useState, useRef, useEffect, useId } = React;
  const [caret, setCaret] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState(0);
  const overlay = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const query = focused && !dismissed ? queryAt(value, caret) : undefined;
  const matches = query
    ? services.filter((service) =>
        `${service.handle} ${service.name} ${service.adapter} ${service.id}`
          .toLowerCase()
          .includes(query.search),
      )
    : [];
  const index = Math.min(selected, Math.max(0, matches.length - 1));
  const querySearch = query?.search;
  useEffect(() => {
    if (querySearch !== undefined)
      document
        .getElementById(`${menuId}-${index}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [querySearch, menuId, index]);
  const sync = (element: HTMLTextAreaElement) => {
    if (overlay.current) {
      overlay.current.scrollTop = element.scrollTop;
      overlay.current.scrollLeft = element.scrollLeft;
      overlay.current.style.paddingRight = `${2 + element.offsetWidth - element.clientWidth}px`;
    }
  };
  useEffect(() => {
    if (inputRef.current) sync(inputRef.current);
    // Controlled resets also reset textarea scroll position.
    void value;
  }, [value, inputRef]);
  useEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => sync(element));
    observer.observe(element);
    return () => observer.disconnect();
  }, [inputRef]);
  const choose = (service: MentionService) => {
    if (!query) return;
    const token = `@${service.handle} `;
    const next = value.slice(0, query.start) + token + value.slice(query.end);
    if (next.length > 16_000) return;
    onChange(next);
    setDismissed(true);
    const position = query.start + token.length;
    setCaret(position);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(position, position);
    });
  };
  return (
    <div className="da-mention-editor">
      {query && (
        <div className="da-mention-menu">
          <div className="da-mention-menu-title">
            Mention a connected service
          </div>
          <div role="listbox" id={menuId} aria-label="Connected services">
            {matches.map((service, optionIndex) => (
              <button
                type="button"
                role="option"
                id={`${menuId}-${optionIndex}`}
                key={service.id}
                aria-selected={optionIndex === index}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(service)}
              >
                <span>
                  <strong>@{service.handle}</strong>
                  <small>{service.name}</small>
                </span>
                <small>{service.adapter}</small>
              </button>
            ))}
          </div>
          {!matches.length && (
            <p className="da-mention-empty">No matching accessible services.</p>
          )}
        </div>
      )}
      <div className="da-mention-overlay" ref={overlay} aria-hidden="true">
        <HighlightedMentions text={value} services={services} />
        {"\n"}
      </div>
      <textarea
        ref={inputRef}
        role="combobox"
        aria-label="Message DSUI Agent"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={Boolean(query)}
        aria-controls={query ? menuId : undefined}
        aria-activedescendant={
          query && matches.length ? `${menuId}-${index}` : undefined
        }
        placeholder="Ask anything… Use @ to mention a service"
        value={value}
        maxLength={16_000}
        disabled={disabled}
        spellCheck={false}
        onFocus={(event) => {
          setFocused(true);
          setCaret(event.currentTarget.selectionStart);
          setDismissed(false);
        }}
        onBlur={() => setFocused(false)}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
        onScroll={(event) => sync(event.currentTarget)}
        onChange={(event) => {
          onChange(event.target.value);
          setCaret(event.target.selectionStart);
          setDismissed(false);
          setSelected(0);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (query && event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setDismissed(true);
            return;
          }
          if (query && matches.length) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const direction = event.key === "ArrowDown" ? 1 : -1;
              setSelected(
                (index + direction + matches.length) % matches.length,
              );
              return;
            }
            if (
              (event.key === "Enter" && !event.shiftKey) ||
              event.key === "Tab"
            ) {
              event.preventDefault();
              const service = matches[index];
              if (service) choose(service);
              return;
            }
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
      />
    </div>
  );
}
