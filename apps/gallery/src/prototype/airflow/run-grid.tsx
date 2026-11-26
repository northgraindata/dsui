/** Runs across, tasks down, as in Airflow's grid. */
import { useState } from "react";
import { TASK_STATES } from "../../../../../packages/adapter-airflow/src/states";
import {
  hasTiming,
  hms,
  type Run,
  stampSeconds,
  taskIds,
  taskKind,
} from "./data";
import { Glyph } from "./icons";
import { Pill, stateLabel } from "./parts";
import { RunTip } from "./run-tip";
import { useTip } from "./tip";

/** A start time is printed on every this many columns, counted from the newest. */
const LABEL_EVERY = 13;
/** Columns a printed time covers; another this close would overlap it. */
const LABEL_WIDTH = 7;

const showNewest = (element: HTMLDivElement | null) => {
  if (element) element.scrollLeft = element.scrollWidth;
};

/** The columns that print their time: the pointed one, the selected one, then a few. */
export function labelledColumns(
  count: number,
  selected: number,
  hovered?: number,
) {
  const first = hovered ?? selected;
  const chosen = [first];
  if (Math.abs(selected - first) >= LABEL_WIDTH) chosen.push(selected);
  for (let index = count - 1; index >= 0; index -= LABEL_EVERY)
    if (chosen.every((other) => Math.abs(other - index) >= LABEL_WIDTH))
      chosen.push(index);
  return chosen;
}

export function RunGrid({
  runs,
  selected,
  onRun,
  onTask,
}: {
  runs: Run[];
  selected: Run;
  onRun: (run: Run) => void;
  onTask: (run: Run, task: string) => void;
}) {
  const tip = useTip();
  const [hovered, setHovered] = useState<number>();
  const [traced, setTraced] = useState<string>();
  // Only states on screen are explained, in Airflow's own order.
  const present = TASK_STATES.filter((state) =>
    runs.some((run) => run.tasks.some((task) => task.state === state)),
  );
  const longest = Math.max(...runs.map((run) => run.seconds));
  // The scale ends on a whole minute, so its middle is easy to read.
  const top = Math.max(120, Math.ceil(longest / 120) * 120);
  const chosen = runs.indexOf(selected);
  const labels = labelledColumns(runs.length, chosen, hovered);
  const mark = (index: number) => ({
    "data-selected": index === chosen || undefined,
    "data-hovered": index === hovered || undefined,
  });
  const point = (index?: number) => {
    setHovered(index);
    if (index === undefined) tip.hide();
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clears the hover highlight
    <div
      className="ax-grid-scroll"
      data-dsui-scroll
      ref={showNewest}
      onMouseLeave={() => point()}
    >
      <div
        className="ax-grid"
        data-traced={traced}
        style={{ "--runs": runs.length } as React.CSSProperties}
      >
        <span className="ax-grid-corner" />
        {runs.map((run, index) => (
          <span
            className="ax-grid-time"
            key={run.at.getTime()}
            {...mark(index)}
          >
            {labels.includes(index) ? (
              <time
                data-edge={
                  index > runs.length - 5
                    ? "end"
                    : index < 4
                      ? "start"
                      : undefined
                }
                dateTime={run.at.toISOString()}
              >
                {stampSeconds(run.at)}
              </time>
            ) : null}
          </span>
        ))}
        <span className="ax-grid-corner ax-grid-axis">
          <b>Duration</b>
          <span>
            <i>{hms(top)}</i>
            <i>{hms(top / 2)}</i>
            <i>{hms(0)}</i>
          </span>
        </span>
        {runs.map((run, index) => (
          <button
            type="button"
            key={run.at.getTime()}
            className="ax-grid-bar"
            aria-pressed={index === chosen}
            aria-label={`Run ${stampSeconds(run.at)}, ${stateLabel[run.state]}, ${hms(run.seconds)}`}
            onClick={() => onRun(run)}
            onFocus={() => setHovered(index)}
            onMouseEnter={(event) => {
              point(index);
              tip.show(event, <RunTip run={run} />);
            }}
            onMouseLeave={tip.hide}
            {...mark(index)}
          >
            <i
              data-state={run.state}
              style={{ height: `${(run.seconds / top) * 100}%` }}
            />
          </button>
        ))}
        {taskIds.map((task) => (
          <div className="ax-grid-line" key={task}>
            <span className="ax-grid-corner ax-grid-label">
              <Glyph name={taskKind[task] ?? "python"} size={13} />
              {task}
            </span>
            {runs.map((run, index) => {
              const item = run.tasks.find((entry) => entry.id === task);
              const state = item?.state ?? "none";
              return (
                <button
                  type="button"
                  key={run.at.getTime()}
                  className="ax-cell"
                  tabIndex={index === chosen ? 0 : -1}
                  aria-label={`${task}, ${stampSeconds(run.at)}, ${stateLabel[state]}`}
                  onClick={() => onTask(run, task)}
                  onMouseEnter={(event) => {
                    point(index);
                    tip.show(
                      event,
                      <>
                        <strong>{task}</strong>
                        <Pill state={state} />
                        <dl>
                          {item && hasTiming(state) ? (
                            <>
                              <dt>Started</dt>
                              <dd>
                                {stampSeconds(
                                  new Date(
                                    run.at.getTime() + item.start * 1000,
                                  ),
                                )}
                              </dd>
                              <dt>Duration</dt>
                              <dd>{hms(item.seconds)}</dd>
                            </>
                          ) : (
                            <>
                              <dt>Run of</dt>
                              <dd>{stampSeconds(run.at)}</dd>
                            </>
                          )}
                        </dl>
                      </>,
                    );
                  }}
                  onMouseLeave={tip.hide}
                  {...mark(index)}
                >
                  <i className="ax-cell-mark" data-state={state} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <ul className="ax-grid-legend" aria-label="Task states in this grid">
        {present.map((state) => (
          <li
            key={state}
            onMouseEnter={() => setTraced(state)}
            onMouseLeave={() => setTraced(undefined)}
          >
            <span className="ax-cell-mark" data-state={state} />
            {stateLabel[state]}
          </li>
        ))}
      </ul>
      {tip.node}
    </div>
  );
}
