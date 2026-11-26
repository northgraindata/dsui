import { Button } from "@northgraindata/dsui-ui";
import { useState } from "react";
import {
  ago,
  clock,
  type Dag,
  dags,
  dayLabel,
  eventLog,
  everythingHealthy,
  failingDags,
  failStreak,
  failureOf,
  health,
  isRunning,
  minutesText,
  pools,
  runStream,
  stamp,
} from "./data";
import { Glyph } from "./icons";
import { Act, Dot, go, Header, IconButton, Panel, Pill } from "./parts";
import { RunStrip } from "./run-strip";

/** Run counts for each of the last 24 whole hours. */
const hours = Array.from({ length: 24 }, (_, index) => {
  const from = ago((24 - index) * 60);
  return {
    from,
    to: new Date(from.getTime() + 3_600_000),
    ok: 5 + ((index * 7) % 6),
    failed: everythingHealthy
      ? 0
      : index === 11 || index === 20
        ? 2
        : index > 20
          ? 1
          : 0,
  };
});

/** The most failures to list before sending the reader to the filtered list. */
const SHOWN = 5;
/** Failures are tall, so fewer fit before the rest of the page. */
const FAILURES_SHOWN = 3;

function FailureRow({
  dag,
  open,
  onToggle,
}: {
  dag: Dag;
  open: boolean;
  onToggle: () => void;
}) {
  const failure = failureOf(dag);
  const streak = failStreak(dag);
  // The line that explains most is the last one before Airflow's exit notice.
  const cause = failure.log.at(-2) ?? "";
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
              <strong>{dag.id}</strong>
              {streak > 1 ? <b>{streak} in a row</b> : null}
            </span>
            <code>{cause}</code>
            <small>
              task <em>{dag.failedTask}</em> · {failure.operator} · try{" "}
              {failure.tries} of {failure.maxTries} · {stamp(dag.lastRun)}
            </small>
          </span>
        </button>
        <RunStrip dag={dag} />
        <span className="ax-row-actions">
          <IconButton
            icon="external"
            label={`Open ${dag.id}`}
            onClick={() => go(`/dags/${dag.id}`)}
          />
          <Act
            iconOnly
            icon="retry"
            label="Retry"
            title={`Retry the failed tasks of ${dag.id}?`}
            description="Clears only the failed task instances of the latest run, so Airflow runs them again."
          />
        </span>
      </div>
      {open ? (
        <pre className="ax-log">
          {failure.log.map((line) => (
            <span
              key={line}
              data-error={line === cause || /ERROR|FAIL |Error/.test(line)}
            >
              {line}
            </span>
          ))}
        </pre>
      ) : null}
    </article>
  );
}

function Failures({ failing }: { failing: Dag[] }) {
  const [open, setOpen] = useState("");
  if (!failing.length) {
    const recent = runStream.find((run) => run.state === "failed");
    return (
      <section className="ax-calm">
        <span className="ax-calm-icon">
          <Glyph name="check" size={22} />
        </span>
        <div>
          <h2>No DAG is failing</h2>
          <p>
            The latest run of all {dags.filter((dag) => !dag.paused).length}{" "}
            active DAGs succeeded or is still running.
          </p>
          {recent ? (
            <small>
              Most recent failed run: {recent.dag}, {stamp(recent.started)}.
              That DAG's latest run is fine.
            </small>
          ) : null}
        </div>
        <Button variant="secondary" onClick={() => go("/runs")}>
          See past runs
        </Button>
      </section>
    );
  }
  return (
    <section className="ax-failures">
      <header>
        <h2>Failing now</h2>
        <b>{failing.length}</b>
        <span className="ax-grow" />
        {failing.length > FAILURES_SHOWN ? (
          <button
            type="button"
            className="ax-link"
            onClick={() => go("/dags?latest=failed")}
          >
            Show all {failing.length} failing DAGs
          </button>
        ) : null}
      </header>
      {failing.slice(0, FAILURES_SHOWN).map((dag) => (
        <FailureRow
          key={dag.id}
          dag={dag}
          open={open === dag.id}
          onToggle={() => setOpen(open === dag.id ? "" : dag.id)}
        />
      ))}
    </section>
  );
}

export function Home() {
  const failing = failingDags();
  const running = dags
    .filter(isRunning)
    .sort((a, b) => b.lastRun.getTime() - a.lastRun.getTime());
  return (
    <>
      <Header
        art="home"
        title="Overview"
        meta={health.map((item) => (
          <span className="ax-health" key={item.name} title={item.detail}>
            <Dot state={item.ok ? "success" : "failed"} />
            {item.name}
          </span>
        ))}
      />
      <Failures failing={failing} />
      <div className="ax-split">
        <Panel
          title="Runs per hour"
          aside={
            <span className="ax-legend">
              <Dot state="success" />
              Succeeded
              <Dot state="failed" />
              Failed
            </span>
          }
        >
          <div className="ax-chart">
            {hours.map((item) => (
              <div key={item.from.getTime()}>
                <button
                  type="button"
                  title={`${dayLabel(item.from)} ${clock(item.from)}–${clock(item.to)}: ${item.ok} succeeded, ${item.failed} failed`}
                >
                  {item.failed ? (
                    <i
                      data-state="failed"
                      style={{ height: item.failed * 12 }}
                    />
                  ) : null}
                  <i data-state="success" style={{ height: item.ok * 9 }} />
                </button>
                <time>
                  {item.from.getHours() % 3 === 0 ? clock(item.from) : ""}
                </time>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Pools"
          aside={
            <button
              type="button"
              className="ax-link"
              onClick={() => go("/pools")}
            >
              Manage
            </button>
          }
        >
          {pools.map((pool) => (
            <div className="ax-meter" key={pool.name}>
              <div>
                <span>{pool.name}</span>
                <small>
                  {pool.running} of {pool.slots}
                  {pool.queued ? ` · ${pool.queued} waiting` : ""}
                </small>
              </div>
              <i>
                <b
                  data-full={pool.running >= pool.slots}
                  style={{ width: `${(pool.running / pool.slots) * 100}%` }}
                />
              </i>
            </div>
          ))}
        </Panel>
      </div>
      <div className="ax-split">
        <Panel
          title={`Running now · ${running.length}`}
          aside={
            <button
              type="button"
              className="ax-link"
              onClick={() => go("/dags?latest=running")}
            >
              View all
            </button>
          }
          flush
        >
          {running.slice(0, SHOWN).map((dag) => (
            <button
              type="button"
              className="ax-row"
              key={dag.id}
              onClick={() => go(`/dags/${dag.id}`)}
            >
              <Pill state="running" />
              <strong>{dag.id}</strong>
              <small>
                since {clock(dag.lastRun)} · usually {minutesText(dag.minutes)}
              </small>
              <Glyph name="arrow" />
            </button>
          ))}
        </Panel>
        <Panel
          title="Changes by people"
          aside={
            <button
              type="button"
              className="ax-link"
              onClick={() => go("/activity")}
            >
              All activity
            </button>
          }
          flush
        >
          {eventLog
            .filter((item) => item.who !== "airflow")
            .slice(0, SHOWN)
            .map((item) => (
              <button
                type="button"
                className="ax-row"
                key={item.id}
                onClick={() => go(item.dag ? `/dags/${item.dag}` : "/activity")}
              >
                <span className="ax-avatar">{item.who.slice(0, 2)}</span>
                <code>{item.event}</code>
                <small>{item.dag}</small>
                <time>{clock(item.at)}</time>
              </button>
            ))}
        </Panel>
      </div>
    </>
  );
}
