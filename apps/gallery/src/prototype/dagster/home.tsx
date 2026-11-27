/* Overview: what is broken first, then what is running and what comes next. */
import {
  Calm,
  FAILURES_SHOWN,
  FailingNow,
  type Failure,
} from "../shared/failures";
import { Glyph } from "../shared/glyphs";
import { Segments, useRemembered } from "../shared/list";
import { Act, go, IconButton, Panel } from "../shared/ui";
import { type AssetState, assetStates, catalog, failing } from "./catalog";
import { eventsOf } from "./events";
import { backfills, daemons, locations, pools, tickFailing } from "./ops";
import { Dot, Header, Pill, runPath } from "./parts";
import { ADHOC, duration, isActive, type Run, runs, runTitle } from "./runs";
import { runStates } from "./states";
import { RunStrip } from "./strips";
import { clock, hms, NOW, stamp } from "./time";
import { RunTimeline } from "./timeline";

/** A summary shows a few rows and links to the rest. */
const SHOWN = 7;
const DAY = 24 * 3_600_000;

const many = (count: number, one: string, more: string) =>
  `${count} ${count === 1 ? one : more}`;

/** Jobs whose latest finished run failed within a day, newest first. */
function failingJobs() {
  return runs
    .filter((run) => run.status === "FAILURE" && run.job !== ADHOC)
    .filter((run) => NOW.getTime() - run.created.getTime() < DAY)
    .filter(
      (run) =>
        runs.find((item) => item.job === run.job && !isActive(item))?.id ===
        run.id,
    );
}

function failureCard(run: Run): Failure {
  const own = runs.filter((item) => item.job === run.job);
  const finished = own.filter((item) => !isActive(item));
  let streak = 0;
  while (finished[streak]?.status === "FAILURE") streak += 1;
  const step = run.failure?.step.split("/").at(-1) ?? "";
  const attempts = run.failure?.attempts ?? 1;
  return {
    id: run.id,
    title: run.job,
    streak,
    cause: run.failure?.line ?? "",
    detail: (
      <>
        step <em>{step}</em>
        {attempts > 1 ? ` · ${attempts} attempts` : ""} · {stamp(run.created)}
      </>
    ),
    strip: <RunStrip runs={own} />,
    actions: (
      <>
        <IconButton
          icon="external"
          label={`Open run ${run.id}`}
          onClick={() => go(runPath(run.id))}
        />
        <Act
          iconOnly
          icon="retry"
          label="Re-execute from failure"
          title={`Re-execute ${run.job} from the failed step?`}
          description="The failed step and everything that depends on it runs again."
        />
      </>
    ),
    log: eventsOf(run)
      .filter((event) => event.step === step)
      .flatMap((event) => [
        `${clock(event.at, true)}  ${event.level}  ${event.message}`,
        ...(event.type === "STEP_FAILURE"
          ? (event.detail?.split("\n") ?? [])
          : []),
      ]),
  };
}

function Failures() {
  const jobs = failingJobs();
  const broken = locations.filter((item) => !item.loaded).length;
  const checks = catalog.flatMap(failing).length;
  const ticks = tickFailing();
  const partial = backfills.filter(
    (item) => item.failed && NOW.getTime() - item.created.getTime() < 2 * DAY,
  ).length;
  const also = [
    broken && {
      label: many(
        broken,
        "code location not loaded",
        "code locations not loaded",
      ),
      path: "/deployment",
    },
    checks && {
      label: many(checks, "failing asset check", "failing asset checks"),
      path: "/assets?state=checks",
    },
    ticks.length && {
      label: many(
        ticks.length,
        "sensor or schedule failing",
        "sensors or schedules failing",
      ),
      path:
        ticks.length === 1 ? `/automation/${ticks[0]?.name}` : "/automation",
    },
    partial && {
      label: many(
        partial,
        "backfill with failed partitions",
        "backfills with failed partitions",
      ),
      path: "/runs?tab=Backfills",
    },
  ].filter((item) => !!item);
  if (!(jobs.length || also.length))
    return (
      <Calm
        title="Nothing is failing"
        text="All code locations are loaded. No job's latest run failed, and every asset check passed."
        action={{ label: "See past runs", path: "/runs" }}
      />
    );
  return (
    <FailingNow
      total={jobs.length}
      failures={jobs.slice(0, FAILURES_SHOWN).map(failureCard)}
      all={{
        label: `Show all ${jobs.length} failing jobs`,
        path: "/runs?state=failed",
      }}
      also={also}
    />
  );
}

/** The instance's parts, as one line under the title. */
function health() {
  const loaded = locations.filter((item) => item.loaded).length;
  return [
    ...daemons.slice(0, 4).map(([name]) => ({ name, ok: true })),
    {
      name: `Code locations ${loaded} of ${locations.length}`,
      ok: loaded === locations.length,
    },
  ];
}

const assetViews: [view: AssetState, label: string][] = [
  ["failed", "Failed"],
  ["stale", "Stale"],
  ["never", "Never materialized"],
  ["materializing", "Materializing"],
  ["fresh", "Materialized"],
];

export function Home() {
  const [hours, setHours] = useRemembered("dx:home:hours", "6");
  const active = runs.filter(isActive);
  const lastDay = runs.filter(
    (run) => NOW.getTime() - run.created.getTime() < DAY,
  );
  const progress = backfills.filter((item) => item.status === "REQUESTED");
  return (
    <>
      <Header
        art="home"
        title="Overview"
        meta={health().map((item) => (
          <span className="ax-health" key={item.name}>
            <Dot tone={item.ok ? "success" : "failed"} />
            {item.name}
          </span>
        ))}
      />
      <Failures />
      <Panel
        title="Run timeline"
        aside={
          <span className="dx-aside">
            <small>
              {lastDay.length} runs in 24 hours,{" "}
              {lastDay.filter((run) => run.status === "FAILURE").length} failed
            </small>
            <Segments
              label="Window"
              value={hours}
              onChange={setHours}
              options={[
                { value: "1", label: "1 h" },
                { value: "6", label: "6 h" },
                { value: "24", label: "24 h" },
              ]}
            />
          </span>
        }
      >
        <RunTimeline hours={Number(hours)} />
      </Panel>
      <div className="ax-split">
        <Panel
          title={`Running and queued · ${active.length}`}
          aside={
            <button
              type="button"
              className="ax-link"
              onClick={() => go("/runs?state=running")}
            >
              View all
            </button>
          }
          flush
        >
          {active.slice(0, SHOWN).map((run) => {
            const [label, tone] = runStates[run.status];
            return (
              <button
                type="button"
                className="ax-row"
                key={run.id}
                onClick={() => go(runPath(run.id))}
              >
                <Pill tone={tone} label={label} />
                <strong>{runTitle(run)}</strong>
                <small title={run.waiting}>
                  {run.waiting ??
                    run.partition ??
                    (run.start ? hms(duration(run)) : "")}
                </small>
                <Glyph name="arrow" />
              </button>
            );
          })}
          {active.length ? null : (
            <p className="ax-empty">No run is in progress.</p>
          )}
        </Panel>
        <div className="ax-stack">
          <Panel
            title="Assets"
            aside={
              <button
                type="button"
                className="ax-link"
                onClick={() => go("/lineage")}
              >
                Lineage
              </button>
            }
          >
            <div className="dx-health">
              {assetViews.map(([view, label]) => (
                <button
                  type="button"
                  key={view}
                  onClick={() => go(`/assets?state=${view}`)}
                >
                  <Dot tone={assetStates[view][1]} />
                  {label}
                  <strong>
                    {catalog.filter((item) => item.state === view).length}
                  </strong>
                </button>
              ))}
            </div>
            {progress.map((item) => (
              <button
                type="button"
                className="dx-backfill-mini"
                key={item.id}
                onClick={() => go(`/backfills/${item.id}`)}
              >
                <small>
                  Backfill of {item.asset.split("/").at(-1)}: {item.done} of{" "}
                  {item.total} partitions
                </small>
                <progress max={item.total} value={item.done} />
              </button>
            ))}
          </Panel>
          <Panel
            title="Concurrency pools"
            aside={
              <button
                type="button"
                className="ax-link"
                onClick={() => go("/deployment?tab=Concurrency")}
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
                    {pool.used} of {pool.limit}
                    {pool.queued ? ` · ${pool.queued} waiting` : ""}
                  </small>
                </div>
                <i>
                  <b
                    data-full={pool.used >= pool.limit}
                    style={{ width: `${(pool.used / pool.limit) * 100}%` }}
                  />
                </i>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </>
  );
}
