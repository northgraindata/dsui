/* Runs over time, one row per job, with what is scheduled next. */

import { useTip } from "../shared/tip";
import { go } from "../shared/ui";
import { instigators } from "./ops";
import { runPath } from "./parts";
import { ADHOC, duration, type Run, runs, runTitle } from "./runs";
import { runStates } from "./states";
import { clock, hms, NOW, stampSeconds } from "./time";

export function RunTimeline({ hours }: { hours: number }) {
  const tip = useTip();
  // A fifth of the window lies ahead, to show what is about to run.
  const past = hours * 3_600_000;
  const ahead = past / 5;
  const from = NOW.getTime() - past;
  const span = past + ahead;
  const place = (at: number) => ((at - from) / span) * 100;
  const inside = runs.filter(
    (run) => run.start && (run.end ?? NOW).getTime() >= from,
  );
  const names = [...new Set(inside.map((run) => run.job))];
  const upcoming = (job: string) => {
    const schedule = instigators.find(
      (item) => item.kind === "schedule" && item.job === job && item.running,
    );
    if (!schedule?.next || !schedule.ticks[1]) return [];
    const every = Math.max(
      60_000,
      (schedule.ticks[0]?.at.getTime() ?? 0) - schedule.ticks[1].at.getTime(),
    );
    const found: number[] = [];
    for (
      let at = schedule.next.getTime();
      at <= NOW.getTime() + ahead;
      at += every
    )
      if (at > NOW.getTime()) found.push(at);
    return found.slice(0, 40);
  };
  const failedFirst = (job: string) =>
    inside.some((run) => run.job === job && run.status === "FAILURE") ? 0 : 1;
  names.sort((a, b) => failedFirst(a) - failedFirst(b) || a.localeCompare(b));
  const step = hours <= 1 ? 0.25 : hours <= 6 ? 1 : 4;
  const marks: number[] = [];
  const first = new Date(from);
  first.setMinutes(0, 0, 0);
  for (
    let at = first.getTime();
    at <= NOW.getTime() + ahead;
    at += step * 3_600_000
  )
    if (at >= from) marks.push(at);
  const label = (run: Run) =>
    `${runTitle(run)}, ${runStates[run.status][0]}, ${stampSeconds(run.start ?? run.created)}, ${hms(duration(run))}`;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only hides the tooltip
    <div className="dx-timeline" onMouseLeave={tip.hide}>
      <div className="dx-timeline-row dx-timeline-axis" aria-hidden="true">
        <span />
        <span>
          {marks.map((at) => (
            <small key={at} style={{ left: `${place(at)}%` }}>
              {clock(new Date(at))}
            </small>
          ))}
        </span>
      </div>
      {names.map((job) => {
        const own = inside.filter((run) => run.job === job);
        const name = job === ADHOC ? "Asset materializations" : job;
        return (
          <div className="dx-timeline-row" key={job}>
            {job === ADHOC ? (
              <span className="dx-timeline-name">{name}</span>
            ) : (
              <button
                type="button"
                className="dx-timeline-name"
                title={name}
                onClick={() => go(`/jobs/${job}`)}
              >
                {name}
              </button>
            )}
            <span className="dx-timeline-track">
              <i
                className="dx-now"
                style={{ left: `${place(NOW.getTime())}%` }}
              />
              {upcoming(job).map((at) => (
                // biome-ignore lint/a11y/noStaticElementInteractions: hover only
                <i
                  key={at}
                  className="dx-next"
                  style={{ left: `${place(at)}%` }}
                  onMouseEnter={(event) =>
                    tip.show(
                      event,
                      <>
                        <strong>{name}</strong>
                        <span>Scheduled for {clock(new Date(at))}</span>
                      </>,
                    )
                  }
                />
              ))}
              {own.map((run) => {
                const left = Math.max(0, place(run.start?.getTime() ?? 0));
                const right = place((run.end ?? NOW).getTime());
                return (
                  <button
                    type="button"
                    key={run.id}
                    className="dx-bar"
                    tabIndex={run.status === "SUCCESS" ? -1 : 0}
                    aria-label={label(run)}
                    data-state={runStates[run.status][1]}
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(0, right - left)}%`,
                    }}
                    onClick={() => go(runPath(run.id))}
                    onMouseEnter={(event) =>
                      tip.show(
                        event,
                        <>
                          <strong>{runTitle(run)}</strong>
                          <span>
                            {runStates[run.status][0]} · {hms(duration(run))}
                          </span>
                          <span>
                            Started {stampSeconds(run.start ?? run.created)}
                          </span>
                          {run.failure ? (
                            <span>
                              {run.failure.step.split("/").at(-1)} failed
                            </span>
                          ) : null}
                        </>,
                      )
                    }
                  />
                );
              })}
            </span>
          </div>
        );
      })}
      {tip.node}
    </div>
  );
}
