/*
 * What an overview opens with: one card of what is failing now, a few rows at
 * most and none of them open, or a calm card when nothing is wrong.
 */
import { Button } from "@northgraindata/dsui-ui";
import { type ReactNode, useState } from "react";
import { Glyph } from "./glyphs";
import { go } from "./ui";

/** Failures are tall, so only a few fit before the rest of the page. */
export const FAILURES_SHOWN = 3;

export interface Failure {
  id: string;
  title: string;
  /** How many times in a row it has failed. */
  streak: number;
  /** The line that explains most. */
  cause: string;
  /** Where it failed and when. */
  detail: ReactNode;
  /** Its recent history. */
  strip: ReactNode;
  actions: ReactNode;
  log: readonly string[];
}

function Row({
  failure,
  open,
  onToggle,
}: {
  failure: Failure;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <article>
      <div className="ax-failure-line">
        <button
          type="button"
          className="ax-failure-main"
          aria-expanded={open}
          onClick={onToggle}
        >
          <Glyph name={open ? "down" : "right"} size={14} />
          <span>
            <span className="ax-failure-title">
              <strong>{failure.title}</strong>
              {failure.streak > 1 ? <b>{failure.streak} in a row</b> : null}
            </span>
            <code>{failure.cause}</code>
            <small>{failure.detail}</small>
          </span>
        </button>
        {failure.strip}
        <span className="ax-row-actions">{failure.actions}</span>
      </div>
      {open ? (
        <pre className="ax-log">
          {failure.log.map((line, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a log only grows
              key={index}
              data-error={
                line === failure.cause || /ERROR|FAIL |Error/.test(line)
              }
            >
              {line}
            </span>
          ))}
        </pre>
      ) : null}
    </article>
  );
}

export function FailingNow({
  total,
  failures,
  all,
  also = [],
}: {
  total: number;
  failures: readonly Failure[];
  all: { label: string; path: string };
  /** Other kinds of trouble, one link each, so the card stays short. */
  also?: readonly { label: string; path: string }[];
}) {
  const [open, setOpen] = useState("");
  return (
    <section className="ax-failures" aria-label="Failing now">
      <header>
        <h2>Failing now</h2>
        {total ? <b>{total}</b> : null}
        <span className="ax-grow" />
        {total > FAILURES_SHOWN ? (
          <button
            type="button"
            className="ax-link"
            onClick={() => go(all.path)}
          >
            {all.label}
          </button>
        ) : null}
      </header>
      {failures.slice(0, FAILURES_SHOWN).map((failure) => (
        <Row
          key={failure.id}
          failure={failure}
          open={open === failure.id}
          onToggle={() => setOpen(open === failure.id ? "" : failure.id)}
        />
      ))}
      {also.length ? (
        <footer className="ax-failures-also">
          {failures.length ? <span>Also</span> : null}
          {also.map((item) => (
            <button
              type="button"
              key={item.label}
              onClick={() => go(item.path)}
            >
              {item.label}
              <Glyph name="right" size={12} />
            </button>
          ))}
        </footer>
      ) : null}
    </section>
  );
}

export function Calm({
  title,
  text,
  note,
  action,
}: {
  title: string;
  text: string;
  note?: string;
  action: { label: string; path: string };
}) {
  return (
    <section className="ax-calm">
      <span className="ax-calm-icon">
        <Glyph name="check" size={22} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
        {note ? <small>{note}</small> : null}
      </div>
      <Button variant="secondary" onClick={() => go(action.path)}>
        {action.label}
      </Button>
    </section>
  );
}
