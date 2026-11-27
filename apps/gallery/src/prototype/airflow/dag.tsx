import { Dialog, Tooltip } from "@northgraindata/dsui-ui";
import { useState } from "react";
import { useTip } from "../shared/tip";
import { ActivityLog } from "./activity";
import { AssetRef } from "./assets";
import { Code } from "./code";
import {
  assets,
  type Dag,
  edges,
  failureLog,
  hasTiming,
  historyOf,
  hms,
  type Run,
  stamp,
  stampSeconds,
  taskIds,
  taskKind,
} from "./data";
import { Glyph } from "./icons";
import {
  Act,
  Header,
  IconButton,
  Panel,
  Pill,
  stateLabel,
  Tabs,
} from "./parts";
import { RunGrid } from "./run-grid";

type Pick = { run: Run; task: string };

/** A step that gives at most five ticks on round times. */
export function tickStep(seconds: number) {
  const steps = [15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21_600];
  return steps.find((step) => seconds / step <= 5) ?? 86_400;
}

/** The ticks share the bars' scale, so a bar's length can be read off them. */
function Gantt({ run, onTask }: { run: Run; onTask: (pick: Pick) => void }) {
  const tip = useTip();
  const step = tickStep(run.seconds);
  // The axis ends on a tick.
  const total = Math.max(1, Math.ceil(run.seconds / step)) * step;
  const at = (seconds: number) => new Date(run.at.getTime() + seconds * 1000);
  return (
    <div
      className="ax-gantt"
      style={{ "--tick": `${(step / total) * 100}%` } as React.CSSProperties}
    >
      <div className="ax-gantt-axis" aria-hidden="true">
        <span />
        <span>
          {Array.from(
            { length: total / step + 1 },
            (_, index) => index * step,
          ).map((second) => (
            <i key={second} style={{ left: `${(second / total) * 100}%` }}>
              {hms(second)}
            </i>
          ))}
        </span>
        <span />
      </div>
      {run.tasks.map((task) => (
        <button
          type="button"
          key={task.id}
          onClick={() => onTask({ run, task: task.id })}
          onMouseLeave={tip.hide}
          onMouseEnter={(event) =>
            tip.show(
              event,
              <>
                <strong>{task.id}</strong>
                <Pill state={task.state} />
                {hasTiming(task.state) ? (
                  <dl>
                    <dt>Started</dt>
                    <dd>{stampSeconds(at(task.start))}</dd>
                    <dt>Ended</dt>
                    <dd>{stampSeconds(at(task.start + task.seconds))}</dd>
                    <dt>Duration</dt>
                    <dd>{hms(task.seconds)}</dd>
                  </dl>
                ) : null}
              </>,
            )
          }
        >
          <span>{task.id}</span>
          <i>
            {hasTiming(task.state) ? (
              <b
                data-state={task.state}
                style={{
                  left: `${(task.start / total) * 100}%`,
                  width: `${(Math.min(task.seconds, total - task.start) / total) * 100}%`,
                }}
              />
            ) : null}
          </i>
          <small data-timed={hasTiming(task.state)}>
            {hasTiming(task.state)
              ? hms(task.seconds)
              : stateLabel[task.state].toLowerCase()}
          </small>
        </button>
      ))}
      {tip.node}
    </div>
  );
}

export function Graph({
  run,
  onTask,
}: {
  run: Run;
  onTask: (pick: Pick) => void;
}) {
  const column = [0, 0, 1, 2, 3, 4];
  const row = [0, 1, 0.5, 0.5, 0.5, 0.5];
  const at = (task: string) => {
    const index = taskIds.indexOf(task);
    return {
      x: (column[index] ?? 0) * 206 + 16,
      y: (row[index] ?? 0) * 96 + 20,
    };
  };
  return (
    <div className="ax-graph-scroll" data-dsui-scroll>
      <div className="ax-graph">
        <svg width="1040" height="190" aria-hidden="true">
          {edges.map(([from, to]) => {
            const a = at(from);
            const b = at(to);
            return (
              <path
                key={from + to}
                d={`M${a.x + 172} ${a.y + 27} C ${a.x + 192} ${a.y + 27}, ${b.x - 20} ${b.y + 27}, ${b.x} ${b.y + 27}`}
              />
            );
          })}
        </svg>
        {run.tasks.map((task) => (
          <button
            type="button"
            key={task.id}
            className="ax-node"
            data-state={task.state}
            style={{ left: at(task.id).x, top: at(task.id).y }}
            onClick={() => onTask({ run, task: task.id })}
          >
            <span>
              <Glyph name={taskKind[task.id] ?? "python"} size={16} />
            </span>
            <strong>{task.id}</strong>
            <small>
              {stateLabel[task.state]}
              {hasTiming(task.state) ? ` · ${hms(task.seconds)}` : ""}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}

/** A task opens beside the run, so the grid and the selection stay. */
function TaskPanel({ pick, onClose }: { pick: Pick; onClose: () => void }) {
  const task = pick.run.tasks.find((item) => item.id === pick.task);
  const failed = task?.state === "failed";
  return (
    <Dialog.Root open onOpenChange={(open) => (open ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="ax-drawer-overlay" />
        <Dialog.Content className="ax-drawer" aria-describedby={undefined}>
          <header>
            <span className="ax-drawer-icon">
              <Glyph name={taskKind[pick.task] ?? "python"} size={20} />
            </span>
            <div>
              <Dialog.Title>{pick.task}</Dialog.Title>
              <p>Run of {stampSeconds(pick.run.at)} · try 1 of 3</p>
            </div>
            <Dialog.Close className="ax-drawer-close" aria-label="Close">
              <Glyph name="close" />
            </Dialog.Close>
          </header>
          <div className="ax-drawer-bar">
            <Pill state={task?.state ?? "none"} />
            <span>{hms(task?.seconds ?? 0)}</span>
            <span>pool: dbt</span>
            <span className="ax-grow" />
            <Act
              icon="retry"
              label="Clear task"
              title={`Clear task ${pick.task}?`}
              description="Airflow runs this task again."
            />
          </div>
          <pre className="ax-log" data-dsui-scroll>
            {(failed
              ? failureLog
              : "[05:00:02] INFO  Task started\n[05:03:11] INFO  Task finished with exit code 0"
            )
              .split("\n")
              .map((line) => (
                <span key={line} data-error={/ERROR|FAIL /.test(line)}>
                  {line}
                </span>
              ))}
          </pre>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DagPage({ dag }: { dag: Dag }) {
  const [tab, setTab] = useState("Overview");
  const runs = historyOf(dag);
  const [run, setRun] = useState(runs.at(-1) as Run);
  const [pick, setPick] = useState<Pick>();
  const produced = assets.filter((asset) => asset.producers.includes(dag.id));
  const consumed = assets.filter((asset) => asset.scheduled.includes(dag.id));
  return (
    <>
      <Header
        art="dags"
        crumbs={[["DAGs", "/dags"]]}
        title={dag.id}
        subtitle={dag.description}
        meta={
          <>
            <Pill state={dag.paused ? "none" : (dag.runs.at(-1) ?? "none")}>
              {dag.paused
                ? "Paused"
                : `Last run ${stateLabel[dag.runs.at(-1) ?? "none"].toLowerCase()}`}
            </Pill>
            <span className="ax-chip">
              <Glyph name="clock" size={13} />
              {dag.schedule} · next{" "}
              {dag.nextRun ? stamp(dag.nextRun) : "paused"}
            </span>
            <span className="ax-chip">
              <span className="ax-avatar">{dag.owner.slice(0, 2)}</span>
              {dag.owner}
            </span>
            {dag.tags.map((tag) => (
              <span className="ax-chip-tag" key={tag}>
                {tag}
              </span>
            ))}
          </>
        }
        actions={
          <>
            <Act
              icon={dag.paused ? "play" : "pause"}
              label={dag.paused ? "Unpause" : "Pause"}
              title={`${dag.paused ? "Unpause" : "Pause"} ${dag.id}?`}
              description={
                dag.paused
                  ? "Its schedule resumes."
                  : "No new runs are scheduled."
              }
            />
            <Act
              icon="bolt"
              variant="default"
              label="Trigger"
              title={`Trigger ${dag.id}?`}
              description="Starts a new run. A paused DAG is unpaused first."
            />
          </>
        }
      />
      <Tabs
        tabs={["Overview", "Graph", "Code", "Activity"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Overview" ? (
        <>
          <Panel
            title="Run history"
            aside={
              <small className="ax-muted">
                {runs.length} runs · click a bar for the run, a square for the
                task
              </small>
            }
          >
            <RunGrid
              runs={runs}
              selected={run}
              onRun={setRun}
              onTask={(next, task) => {
                setRun(next);
                setPick({ run: next, task });
              }}
            />
          </Panel>
          <div className="ax-split">
            <Panel
              title={
                <>
                  Run of {stampSeconds(run.at)} <Pill state={run.state} />
                </>
              }
              aside={
                <span className="ax-row-actions">
                  <IconButton icon="stop" label="Terminate run" />
                  <IconButton icon="retry" label="Clear run" />
                </span>
              }
            >
              <Gantt run={run} onTask={setPick} />
            </Panel>
            <Panel title="Data">
              <p className="ax-group-label">Waits for</p>
              {consumed.map((asset) => (
                <AssetRef key={asset.id} asset={asset} />
              ))}
              {consumed.length ? null : (
                <p className="ax-muted">Nothing declared.</p>
              )}
              <p className="ax-group-label">Writes</p>
              {produced.map((asset) => (
                <AssetRef key={asset.id} asset={asset} />
              ))}
              {produced.length ? null : (
                <p className="ax-muted">Nothing declared.</p>
              )}
            </Panel>
          </div>
        </>
      ) : tab === "Graph" ? (
        <Panel title={`Graph of the run of ${stampSeconds(run.at)}`}>
          <Graph run={run} onTask={setPick} />
        </Panel>
      ) : tab === "Code" ? (
        <Code dag={dag} />
      ) : (
        <ActivityLog dag={dag.id} />
      )}
      {pick ? (
        <TaskPanel pick={pick} onClose={() => setPick(undefined)} />
      ) : null}
    </>
  );
}
