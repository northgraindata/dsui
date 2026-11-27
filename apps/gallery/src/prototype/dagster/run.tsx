/* One run: what happened to each step, and what it said. */
import { Button, Menu, notify } from "@northgraindata/dsui-ui";
import { useState } from "react";
import { Glyph } from "../shared/glyphs";
import { Search, Segments } from "../shared/list";
import { Source } from "../shared/source";
import { useTip } from "../shared/tip";
import { Act, go, Panel, Tabs } from "../shared/ui";
import { eventsOf, type RunEvent } from "./events";
import { assetPath, Dot, Header, LaunchedBy, RunPill, runPath } from "./parts";
import {
  ADHOC,
  duration,
  isActive,
  type Run,
  runs,
  runTitle,
  type Step,
  stepsOf,
} from "./runs";
import { stepStates } from "./states";
import { clock, hms, stampSeconds } from "./time";

const copy = (text: string, what: string) => {
  void navigator.clipboard?.writeText(text);
  notify.success(`${what} copied`);
};

const stepLabel = (step: Step) =>
  step.status ? stepStates[step.status] : (["Not started", "none"] as const);

function Timeline({
  run,
  steps,
  picked,
  onPick,
}: {
  run: Run;
  steps: Step[];
  picked: string;
  onPick: (step: string) => void;
}) {
  const tip = useTip();
  const total = Math.max(
    1,
    duration(run),
    ...steps.map((step) => step.from + step.seconds),
  );
  const percent = (value: number) => `${(value / total) * 100}%`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const start = run.start?.getTime() ?? 0;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only hides the tooltip
    <div className="dx-gantt" data-dsui-scroll onMouseLeave={tip.hide}>
      <div className="dx-gantt-axis" aria-hidden="true">
        <span />
        <span>
          {ticks.map((tick) => (
            <small key={tick} style={{ left: `${tick * 100}%` }}>
              {hms(total * tick)}
            </small>
          ))}
        </span>
        <span />
      </div>
      {steps.map((step) => {
        const [label, tone] = stepLabel(step);
        return (
          <button
            type="button"
            key={step.key}
            aria-pressed={picked === step.name}
            aria-label={`Step ${step.name}, ${label}${step.seconds ? `, ${hms(step.seconds)}` : ""}`}
            onClick={() => onPick(picked === step.name ? "" : step.name)}
          >
            <span className="dx-gantt-name">
              <Dot tone={tone} />
              <code title={step.name}>{step.name}</code>
            </span>
            <span className="dx-gantt-track">
              {step.status === "SKIPPED" || !step.status ? (
                <em>{label}</em>
              ) : (
                step.attempts.map((attempt, index) => {
                  const last = index === step.attempts.length - 1;
                  const width =
                    last && step.status === "IN_PROGRESS"
                      ? step.seconds
                      : attempt.seconds;
                  return (
                    // biome-ignore lint/a11y/noStaticElementInteractions: hover only; the row says the rest
                    <i
                      key={attempt.from}
                      data-state={last ? tone : "up_for_retry"}
                      style={{
                        left: percent(attempt.from),
                        width: percent(width),
                      }}
                      onMouseEnter={(event) =>
                        tip.show(
                          event,
                          <>
                            <strong>{step.name}</strong>
                            <span>
                              {step.attempts.length > 1
                                ? `Attempt ${index + 1} of ${step.attempts.length} · `
                                : ""}
                              {last ? label : "Failed, retried"}
                            </span>
                            <span>
                              Started{" "}
                              {clock(
                                new Date(start + attempt.from * 1000),
                                true,
                              )}{" "}
                              · {hms(width)}
                            </span>
                          </>,
                        )
                      }
                    />
                  );
                })
              )}
            </span>
            <code className="dx-gantt-time">
              {step.seconds ? hms(step.seconds) : "—"}
            </code>
          </button>
        );
      })}
      {tip.node}
    </div>
  );
}

const levels = ["DEBUG", "INFO", "WARNING", "ERROR"];

function Events({
  events,
  step,
  onClearStep,
}: {
  events: RunEvent[];
  step: string;
  onClearStep: () => void;
}) {
  const [level, setLevel] = useState("INFO");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const inStep = events.filter((event) => !step || event.step === step);
  const count = (name: string) =>
    inStep.filter((event) => event.level === name).length;
  const rows = inStep.filter(
    (event) =>
      levels.indexOf(event.level) >= levels.indexOf(level) &&
      `${event.type} ${event.message} ${event.step ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="dx-events">
      <div className="dx-events-tools">
        <Segments
          label="Level"
          value={level}
          onChange={setLevel}
          options={[
            { value: "DEBUG", label: "All" },
            { value: "INFO", label: "Info and up" },
            {
              value: "WARNING",
              label: "Warnings",
              tone: "up_for_retry",
              count: count("WARNING"),
            },
            {
              value: "ERROR",
              label: "Errors",
              tone: "failed",
              count: count("ERROR"),
            },
          ]}
        />
        {step ? (
          <button
            type="button"
            className="dx-step-chip"
            onClick={onClearStep}
            aria-label={`Stop filtering by step ${step}`}
          >
            Step: {step}
            <Glyph name="close" size={12} />
          </button>
        ) : null}
        <span className="ax-grow" />
        <Search label="Find in events" value={search} onChange={setSearch} />
        <Button
          size="small"
          variant="secondary"
          onClick={() =>
            copy(
              rows
                .map(
                  (event) =>
                    `${clock(event.at, true)} ${event.level} ${event.step ?? ""} ${event.type} ${event.message}`,
                )
                .join("\n"),
              "Events",
            )
          }
        >
          <Glyph name="copy" size={13} />
          Copy
        </Button>
      </div>
      <div className="dx-event-list" data-dsui-scroll>
        {rows.map((event, index) => (
          <div
            key={`${event.at.getTime()}${event.type}${event.step}${event.message}`}
            className="dx-event"
            data-level={event.level}
          >
            <time>{clock(event.at, true)}</time>
            <code>{event.step ?? "—"}</code>
            <b>{event.type}</b>
            <span>
              {event.message}
              {/* A failure's stack is always open; others on request. */}
              {event.detail && event.type !== "STEP_FAILURE" ? (
                <button
                  type="button"
                  className="ax-link"
                  aria-expanded={open.has(index)}
                  onClick={() => {
                    const next = new Set(open);
                    if (!next.delete(index)) next.add(index);
                    setOpen(next);
                  }}
                >
                  {open.has(index) ? "Hide stack" : "Show stack"}
                </button>
              ) : null}
              {event.detail &&
              (open.has(index) || event.type === "STEP_FAILURE") ? (
                <pre>{event.detail}</pre>
              ) : null}
            </span>
          </div>
        ))}
        {rows.length ? null : <p className="ax-empty">No events match.</p>}
      </div>
    </div>
  );
}

function Output({
  run,
  step,
  kind,
}: {
  run: Run;
  step: string;
  kind: "stdout" | "stderr";
}) {
  const events = eventsOf(run).filter((event) => event.step === step);
  const text =
    kind === "stdout"
      ? events
          .filter((event) => event.type === "LOG_MESSAGE")
          .map((event) => `${clock(event.at, true)}  ${event.message}`)
          .join("\n")
      : events
          .filter((event) => event.detail && event.level === "ERROR")
          .map((event) => event.detail)
          .join("\n");
  return text ? (
    <pre className="ax-log dx-output" data-dsui-scroll>
      {text}
    </pre>
  ) : (
    <p className="ax-empty">
      {step} wrote nothing to {kind}.
    </p>
  );
}

const configOf = (run: Run) =>
  run.job === ADHOC
    ? `execution:\n  config:\n    max_concurrent: 4\nops: {}`
    : `ops:\n  ${run.job}:\n    config:\n      target: prod\n      full_refresh: false\nresources:\n  warehouse:\n    config:\n      role: TRANSFORMER\n      schema:\n        env: SNOWFLAKE_SCHEMA\nexecution:\n  config:\n    max_concurrent: 4`;

export function RunPage({ run }: { run: Run }) {
  const steps = stepsOf(run);
  const events = eventsOf(run);
  const broken = run.failure?.step.split("/").at(-1);
  const [picked, setPicked] = useState("");
  const [tab, setTab] = useState("Events");
  const outputStep = picked || broken || steps[0]?.name || "";
  const tags: [string, string][] = [
    [
      "dagster/run_key",
      run.by.kind === "sensor" ? `${run.by.name}:${run.id}` : "—",
    ],
    [
      `dagster/${run.by.kind === "sensor" ? "sensor" : "schedule"}_name`,
      run.by.kind === "schedule" || run.by.kind === "sensor"
        ? run.by.name
        : "—",
    ],
    ["dagster/partition", run.partition ?? "—"],
    ["dagster/backfill", run.backfill ?? "—"],
    ["dagster/image", "acme/dagster-analytics:2026.11.27-3"],
  ].filter(([, value]) => value !== "—") as [string, string][];
  const same = runs
    .filter((item) => item.job === run.job && item.id !== run.id)
    .slice(0, 1)[0];
  const done = steps.filter((step) => step.status === "SUCCESS").length;
  return (
    <>
      <Header
        art="runs"
        title={<code className="dx-title-code">{run.id}</code>}
        crumbs={[["Runs", "/runs"]]}
        meta={
          <>
            <RunPill run={run} />
            {run.job === ADHOC ? (
              <span>{runTitle(run)}</span>
            ) : (
              <button
                type="button"
                className="ax-link"
                onClick={() => go(`/jobs/${run.job}`)}
              >
                {run.job}
              </button>
            )}
            {run.partition ? (
              <span className="ax-chip">Partition {run.partition}</span>
            ) : null}
            <LaunchedBy by={run.by} />
            <span>
              {run.start
                ? `Started ${stampSeconds(run.start)}`
                : `Queued ${stampSeconds(run.created)}`}
            </span>
            {run.start ? <span>Duration {hms(duration(run))}</span> : null}
            <span>
              {done} of {steps.length} steps succeeded
            </span>
          </>
        }
        actions={
          isActive(run) ? (
            <Act
              icon="stop"
              label="Terminate"
              title={`Terminate run ${run.id}?`}
              description="Steps that are running are interrupted. Assets they already materialized stay."
            />
          ) : (
            <>
              {run.failure ? (
                <Act
                  variant="default"
                  icon="retry"
                  label="Re-execute from failure"
                  title={`Re-execute ${run.id} from ${broken}?`}
                  description="The failed step and everything that depends on it runs again. Earlier results are reused."
                />
              ) : null}
              <Menu
                trigger={
                  <Button variant="secondary">
                    Re-execute
                    <Glyph name="down" size={13} />
                  </Button>
                }
                items={[
                  {
                    label: "All steps",
                    icon: <Glyph name="retry" />,
                    onSelect: () =>
                      notify.success("All steps launched again (prototype)"),
                  },
                  ...(picked
                    ? [
                        {
                          label: `Only ${picked}`,
                          icon: <Glyph name="play" />,
                          onSelect: () =>
                            notify.success(`${picked} launched (prototype)`),
                        },
                        {
                          label: `${picked} and downstream`,
                          icon: <Glyph name="arrow" />,
                          onSelect: () =>
                            notify.success(
                              `${picked} and downstream launched (prototype)`,
                            ),
                        },
                      ]
                    : []),
                  {
                    label: "Copy run ID",
                    icon: <Glyph name="copy" />,
                    onSelect: () => copy(run.id, "Run ID"),
                  },
                ]}
              />
            </>
          )
        }
      />
      {run.failure ? (
        <section className="dx-run-failure">
          <Glyph name="alert" size={18} />
          <div>
            <strong>
              {broken} failed
              {run.failure.attempts > 1
                ? ` after ${run.failure.attempts} attempts`
                : ""}
            </strong>
            <code>{run.failure.line}</code>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={() => {
              setPicked(broken ?? "");
              setTab("Events");
              document
                .querySelector(".dx-events")
                ?.scrollIntoView({ block: "start" });
            }}
          >
            Show in log
          </Button>
          <Button
            size="small"
            variant="ghost"
            onClick={() => go(assetPath(run.failure?.step ?? ""))}
          >
            Open asset
          </Button>
        </section>
      ) : null}
      {run.waiting ? (
        <section className="dx-run-waiting">
          <Glyph name="clock" size={16} />
          <span>{run.waiting}</span>
          <button
            type="button"
            className="ax-link"
            onClick={() => go("/deployment?tab=Concurrency")}
          >
            View pools
          </button>
        </section>
      ) : null}
      <Panel
        title="Steps"
        aside={
          <small>
            {picked
              ? "Events show this step only"
              : "Select a step to filter its events"}
          </small>
        }
        flush
      >
        <Timeline run={run} steps={steps} picked={picked} onPick={setPicked} />
      </Panel>
      <Tabs
        tabs={["Events", "stdout", "stderr", "Config", "Tags"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Events" ? (
        <Events
          events={events}
          step={picked}
          onClearStep={() => setPicked("")}
        />
      ) : null}
      {tab === "stdout" || tab === "stderr" ? (
        <>
          <p className="dx-output-step">
            Output of <code>{outputStep}</code>. Select another step above.
          </p>
          <Output run={run} step={outputStep} kind={tab} />
        </>
      ) : null}
      {tab === "Config" ? (
        <Source name="config.yaml" text={configOf(run)} />
      ) : null}
      {tab === "Tags" ? (
        <Panel>
          {tags.length ? (
            <dl className="dx-dl">
              {tags.map(([name, value]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="ax-muted">This run has no tags.</p>
          )}
        </Panel>
      ) : null}
      {same ? (
        <button
          type="button"
          className="ax-link dx-previous"
          onClick={() => go(runPath(same.id))}
        >
          Latest other run of {runTitle(run)}: {same.id}
        </button>
      ) : null}
    </>
  );
}
