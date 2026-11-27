import { useEffect, useRef, useState } from "react";
import { Glyph } from "../shared/glyphs";
import { buckets } from "./data";

/** Names the open bucket, and changes it without leaving the view. */
export function BucketSwitcher({
  bucket,
  onChoose,
}: {
  bucket: string;
  onChoose: (bucket: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const info = buckets.find((item) => item.name === bucket);
  const matching = buckets
    .filter((item) => item.name.includes(filter.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", outside);
    return () => window.removeEventListener("pointerdown", outside);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const choose = (name: string) => {
    close();
    onChoose(name);
  };

  return (
    <div className="s3-switch" ref={root}>
      <button
        type="button"
        ref={trigger}
        className="s3-switch-trigger"
        aria-expanded={open}
        aria-label={`Open bucket: ${bucket}. Change bucket`}
        title={bucket}
        onClick={() => {
          setFilter("");
          setActive(0);
          setOpen(!open);
        }}
      >
        <span>
          <strong>{bucket}</strong>
          <small>{info?.region}</small>
        </span>
        <Glyph name="down" size={14} />
      </button>
      {open ? (
        <div className="s3-switch-menu">
          <input
            // biome-ignore lint/a11y/noAutofocus: the menu was just asked for
            autoFocus
            role="combobox"
            aria-label="Find a bucket to open"
            aria-expanded="true"
            aria-controls="s3-switch-list"
            aria-activedescendant={
              matching[active]
                ? `s3-switch-${matching[active].name}`
                : undefined
            }
            placeholder={`Find in ${buckets.length} buckets`}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              // These keys belong to the menu, not to the file list behind it.
              event.stopPropagation();
              if (event.key === "Escape") return close();
              if (event.key === "Enter") {
                const item = matching[active];
                return item ? choose(item.name) : undefined;
              }
              const step =
                event.key === "ArrowDown"
                  ? 1
                  : event.key === "ArrowUp"
                    ? -1
                    : 0;
              if (!step) return;
              event.preventDefault();
              const next = Math.max(
                0,
                Math.min(matching.length - 1, active + step),
              );
              setActive(next);
              root.current
                ?.querySelector(`[data-index="${next}"]`)
                ?.scrollIntoView({ block: "nearest" });
            }}
          />
          <div id="s3-switch-list" role="listbox" data-dsui-scroll>
            {matching.map((item, index) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                id={`s3-switch-${item.name}`}
                key={item.name}
                data-index={index}
                data-active={index === active}
                aria-selected={item.name === bucket}
                title={item.name}
                onClick={() => choose(item.name)}
              >
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.region}</small>
                </span>
                {item.name === bucket ? <Glyph name="check" size={13} /> : null}
              </button>
            ))}
            {matching.length ? null : <p>No bucket matches.</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
