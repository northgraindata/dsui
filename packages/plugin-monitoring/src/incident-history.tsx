import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import { z } from "zod";
import { React } from "./react";

const entrySchema = z.object({
  id: z.string(),
  title: z.string(),
  details: z.record(z.union([z.string(), z.number()])),
});
const historySchema = z.object({
  summary: z.record(z.union([z.string(), z.number()])),
  processes: z.array(entrySchema),
  items: z.array(entrySchema),
});
type Entry = z.infer<typeof entrySchema>;
const styles = `
.monitoring-history { margin: 28px 0; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); }
.monitoring-history summary { cursor: pointer; list-style: none; }
.monitoring-history summary::-webkit-details-marker { display: none; }
.monitoring-history summary:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; border-radius: 8px; }
.monitoring-history-head { display: flex; align-items: center; gap: 12px; padding: 16px 18px; }
.monitoring-history-icon { display: grid; place-items: center; width: 34px; height: 34px; flex: none; border: 1px solid var(--color-border); border-radius: 9px; color: var(--color-secondary); background: var(--color-surface-raised); }
.monitoring-history-heading { display: grid; flex: 1; gap: 4px; min-width: 0; }
.monitoring-history-heading strong { color: var(--color-primary); font-size: 13px; font-weight: 600; }
.monitoring-history-heading span { color: var(--color-muted); font-size: 12px; line-height: 1.4; }
.monitoring-history-chevron { flex: none; color: var(--color-muted); transition: transform 150ms ease; }
.monitoring-history details[open] > summary .monitoring-history-chevron { transform: rotate(90deg); }
.monitoring-history-body { padding: 0 18px 18px; border-top: 1px solid var(--color-border); }
.monitoring-history-group { margin-top: 20px; }
.monitoring-history-group h3 { margin: 0 0 10px; color: var(--color-primary); font-size: 12px; font-weight: 600; }
.monitoring-history-note { margin: 0; color: var(--color-muted); font-size: 12px; line-height: 1.5; }
.monitoring-history-list { max-height: 420px; overflow: auto; border: 1px solid var(--color-border); border-radius: 8px; }
.monitoring-history-entry + .monitoring-history-entry { border-top: 1px solid var(--color-border); }
.monitoring-history-entry > summary { display: flex; align-items: center; gap: 10px; padding: 11px 12px; color: var(--color-primary); font-size: 12px; }
.monitoring-history-entry > summary:hover { background: var(--color-surface-hover); }
.monitoring-history-entry-label { flex: 1; min-width: 0; overflow-wrap: anywhere; line-height: 1.4; }
.monitoring-history-entry-label small { display: block; margin-top: 3px; color: var(--color-muted); font-size: 11px; }
.monitoring-history-entry-icon { display: grid; place-items: center; flex: none; color: var(--color-secondary); }
.monitoring-history-fields { display: grid; grid-template-columns: minmax(110px, 180px) minmax(0, 1fr); gap: 8px 16px; margin: 0; padding: 4px 14px 14px 38px; font-size: 12px; line-height: 1.45; }
.monitoring-history-fields dt { color: var(--color-muted); }
.monitoring-history-fields dd { margin: 0; color: var(--color-secondary); overflow-wrap: anywhere; }
.monitoring-history-error { color: var(--color-unavailable); }
@media (max-width: 600px) { .monitoring-history-fields { grid-template-columns: 1fr; gap: 3px; } .monitoring-history-fields dd { margin-bottom: 8px; } }
@media (prefers-reduced-motion: reduce) { .monitoring-history-chevron { transition: none; } }
`;
function Icon({ kind }: { kind: "activity" | "server" | "clock" | "chevron" }) {
  const paths = {
    activity: "M3 12h4l3-7 4 14 3-7h4",
    server: "M5 4h14v6H5z M5 14h14v6H5z M8 7h.01 M8 17h.01",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2",
    chevron: "M9 6l6 6-6 6",
  };
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}
function Fields({ fields }: { fields: Record<string, string | number> }) {
  return (
    <dl className="monitoring-history-fields">
      {Object.entries(fields).map(([label, value]) => (
        <React.Fragment key={label}>
          <dt>{label}</dt>
          <dd>{String(value)}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
function Entries({
  entries,
  kind,
}: {
  entries: Entry[];
  kind: "server" | "clock";
}) {
  if (!entries.length)
    return (
      <p className="monitoring-history-note">
        No{" "}
        {kind === "server" ? "isolated adapter processes" : "recent activity"}{" "}
        recorded.
      </p>
    );
  return (
    <div className="monitoring-history-list">
      {entries.map((entry) => (
        <details className="monitoring-history-entry" key={entry.id}>
          <summary>
            <span className="monitoring-history-entry-icon">
              <Icon kind={kind} />
            </span>
            <span className="monitoring-history-entry-label">
              {entry.title}
              {entry.details.Started && (
                <small>
                  {String(entry.details.Started)
                    .replace("T", " ")
                    .replace("Z", " UTC")}
                  {entry.details.Outcome && ` · ${entry.details.Outcome}`}
                </small>
              )}
            </span>
            <span className="monitoring-history-chevron">
              <Icon kind="chevron" />
            </span>
          </summary>
          <Fields fields={entry.details} />
        </details>
      ))}
    </div>
  );
}
export function IncidentHistory({ client }: ComponentProps) {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<z.infer<typeof historySchema>>();
  const [error, setError] = React.useState<string>();
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    let running = false;
    const load = () => {
      if (running) return;
      running = true;
      void client
        .executeResource({ resourceId: "incident-history", input: {} })
        .then((result) => {
          if (active) {
            setData(historySchema.parse(result));
            setError(undefined);
          }
        })
        .catch((cause: unknown) => {
          if (active)
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not load diagnostics.",
            );
        })
        .finally(() => {
          running = false;
        });
    };
    load();
    const timer = setInterval(load, 10_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [client, open]);
  return (
    <section className="monitoring-history">
      <style>{styles}</style>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="monitoring-history-head">
          <span className="monitoring-history-icon">
            <Icon kind="activity" />
          </span>
          <span className="monitoring-history-heading">
            <strong>Incident history</strong>
            <span>
              Resource samples and adapter operations · retained for 7 days
            </span>
          </span>
          <span className="monitoring-history-chevron">
            <Icon kind="chevron" />
          </span>
        </summary>
        <div className="monitoring-history-body">
          {error && (
            <p
              className="monitoring-history-note monitoring-history-error"
              role="alert"
            >
              {error}
            </p>
          )}
          {!data && !error && (
            <p className="monitoring-history-note" role="status">
              Loading diagnostics…
            </p>
          )}
          {data && (
            <>
              <div className="monitoring-history-group">
                <h3>Adapter processes</h3>
                <Entries entries={data.processes} kind="server" />
              </div>
              <div className="monitoring-history-group">
                <h3>Recent activity</h3>
                <Entries entries={data.items} kind="clock" />
              </div>
              <details className="monitoring-history-group monitoring-history-entry">
                <summary>
                  <span className="monitoring-history-entry-label">
                    Collection details
                  </span>
                  <span className="monitoring-history-chevron">
                    <Icon kind="chevron" />
                  </span>
                </summary>
                <Fields fields={data.summary} />
                <p className="monitoring-history-note">
                  Timestamps are UTC. Inputs and result contents are never
                  recorded.
                </p>
              </details>
            </>
          )}
        </div>
      </details>
    </section>
  );
}
