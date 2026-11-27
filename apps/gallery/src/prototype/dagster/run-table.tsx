/* One table of runs, for the Runs page and for a job's or a backfill's runs. */
import { Button, notify } from "@northgraindata/dsui-ui";
import { useState } from "react";
import {
  Choice,
  Empty,
  Search,
  Segments,
  Toolbar,
  unique,
  usePages,
  useRemembered,
} from "../shared/list";
import { Act, go, IconButton, Panel } from "../shared/ui";
import { Dot, LaunchedBy, runPath } from "./parts";
import { duration, isActive, type Run, runTitle } from "./runs";
import { runStates } from "./states";
import { hms, NOW, stampSeconds } from "./time";

const buckets = {
  all: () => true,
  failed: (run: Run) => run.status === "FAILURE",
  running: (run: Run) =>
    ["STARTING", "STARTED", "CANCELING"].includes(run.status),
  queued: (run: Run) => run.status === "QUEUED",
  success: (run: Run) => run.status === "SUCCESS",
  canceled: (run: Run) => run.status === "CANCELED",
};
type Bucket = keyof typeof buckets;

const periods: Record<string, number> = { "1": 1, "24": 24, "168": 168 };

export function RunTable({
  id,
  runs,
  fixedJob = false,
  initial = "all",
}: {
  id: string;
  runs: readonly Run[];
  /** Every row has the same job, so the job is not repeated. */
  fixedJob?: boolean;
  initial?: Bucket;
}) {
  const [filters, setFilters] = useRemembered(`dx:runs:${id}:${initial}`, {
    state: initial as Bucket,
    job: "",
    by: "",
    period: "",
    search: "",
  });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const matching = runs.filter(
    (run) =>
      (!filters.job || run.job === filters.job) &&
      (!filters.by || run.by.name === filters.by) &&
      (!filters.period ||
        NOW.getTime() - run.created.getTime() <=
          (periods[filters.period] ?? 0) * 3_600_000) &&
      (!filters.search || run.id === filters.search.trim().toLowerCase()),
  );
  const rows = matching.filter(buckets[filters.state]);
  const { visible, pager } = usePages(
    `dx:runs:${id}`,
    rows,
    JSON.stringify(filters),
  );
  const chosen = rows.filter((run) => selected.has(run.id));
  const active = chosen.filter(isActive);
  const failed = chosen.filter((run) => run.status === "FAILURE");
  const longest = Math.max(1, ...visible.map(duration));
  const change = (next: Partial<typeof filters>) => {
    setSelected(new Set());
    setFilters({ ...filters, ...next });
  };
  const segment = (value: Bucket, label: string, tone?: string) => ({
    value,
    label,
    tone,
    count: matching.filter(buckets[value]).length,
  });
  const allChosen =
    visible.length > 0 && visible.every((run) => selected.has(run.id));
  return (
    <>
      <Toolbar>
        <Segments
          label="Status"
          value={filters.state}
          onChange={(state) => change({ state })}
          options={[
            segment("all", "All"),
            segment("failed", "Failed", "failed"),
            segment("running", "In progress", "running"),
            segment("queued", "Queued", "queued"),
            segment("success", "Succeeded", "success"),
            segment("canceled", "Canceled", "removed"),
          ]}
        />
      </Toolbar>
      <Toolbar>
        {chosen.length ? (
          <div className="dx-selection">
            <IconButton
              icon="close"
              label="Clear selection"
              onClick={() => setSelected(new Set())}
            />
            <strong>{chosen.length} selected</strong>
            <span className="ax-grow" />
            {active.length ? (
              <Act
                icon="stop"
                label={`Terminate ${active.length}`}
                title={`Terminate ${active.length} run${active.length === 1 ? "" : "s"}?`}
                description="Steps that are running are interrupted. Assets they already materialized stay."
              />
            ) : null}
            {failed.length ? (
              <Act
                icon="retry"
                label={`Re-execute ${failed.length} from failure`}
                title={`Re-execute ${failed.length} failed run${failed.length === 1 ? "" : "s"}?`}
                description="Each new run starts at the failed step and runs what depends on it."
              />
            ) : null}
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(
                  chosen.map((run) => run.id).join("\n"),
                );
                notify.success("Run IDs copied");
              }}
            >
              Copy IDs
            </Button>
          </div>
        ) : (
          <>
            <Search
              label="Full run ID"
              value={filters.search}
              onChange={(search) => change({ search })}
            />
            {fixedJob ? null : (
              <Choice
                all="All jobs"
                value={filters.job}
                options={unique(runs.map((run) => run.job))}
                names={{ __ASSET_JOB: "Asset materializations" }}
                onChange={(job) => change({ job })}
              />
            )}
            <Choice
              all="Any schedule, sensor or backfill"
              value={filters.by}
              options={unique(
                runs
                  .filter((run) => run.by.kind !== "manual")
                  .map((run) => run.by.name),
              )}
              onChange={(by) => change({ by })}
            />
            <Choice
              all="Any time"
              value={filters.period}
              options={["1", "24", "168"]}
              names={{
                "1": "Last hour",
                "24": "Last 24 hours",
                "168": "Last 7 days",
              }}
              onChange={(period) => change({ period })}
            />
          </>
        )}
      </Toolbar>
      <Panel flush>
        <div
          className="ax-table dx-run-table"
          data-fixed={fixedJob}
          data-dsui-scroll
        >
          <div className="ax-thead">
            <input
              type="checkbox"
              aria-label="Select all runs on this page"
              checked={allChosen}
              onChange={() =>
                setSelected(
                  allChosen ? new Set() : new Set(visible.map((run) => run.id)),
                )
              }
            />
            <span />
            <span>Run</span>
            {fixedJob ? null : <span>Job</span>}
            <span>Launched by</span>
            <span>Created</span>
            <span>Duration</span>
            <span />
          </div>
          {visible.map((run) => {
            const [label, tone] = runStates[run.status];
            return (
              // biome-ignore lint/a11y/useSemanticElements: the row holds buttons
              <div
                className="ax-tr"
                role="link"
                tabIndex={0}
                key={run.id}
                aria-label={`Run ${run.id}, ${label}`}
                onClick={() => go(runPath(run.id))}
                onKeyDown={(event) =>
                  event.key === "Enter" &&
                  event.target === event.currentTarget &&
                  go(runPath(run.id))
                }
              >
                <input
                  type="checkbox"
                  aria-label={`Select run ${run.id}`}
                  checked={selected.has(run.id)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => {
                    const next = new Set(selected);
                    if (!next.delete(run.id)) next.add(run.id);
                    setSelected(next);
                  }}
                />
                <Dot tone={tone} label={label} />
                <span className="dx-two">
                  <code>{run.id}</code>
                  <small title={run.failure?.line ?? run.waiting}>
                    {run.failure
                      ? `${run.failure.step.split("/").at(-1)}: ${run.failure.line}`
                      : (run.waiting ?? label)}
                  </small>
                </span>
                {fixedJob ? null : (
                  <span className="dx-two">
                    <strong title={runTitle(run)}>{runTitle(run)}</strong>
                    <small>
                      {run.partition ??
                        (run.selection.length > 1
                          ? `${run.selection.length} assets`
                          : "")}
                    </small>
                  </span>
                )}
                <LaunchedBy by={run.by} />
                <span>{stampSeconds(run.created)}</span>
                <span className="ax-duration">
                  {run.start ? (
                    <>
                      <code>{hms(duration(run))}</code>
                      <i
                        data-state={tone}
                        style={{
                          width: `${Math.max(3, (duration(run) / longest) * 48)}px`,
                        }}
                      />
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                {/* biome-ignore lint/a11y/noStaticElementInteractions: only stops the row from opening */}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the row from opening */}
                <span
                  className="ax-row-actions"
                  onClick={(event) => event.stopPropagation()}
                >
                  {isActive(run) ? (
                    <Act
                      iconOnly
                      icon="stop"
                      label="Terminate"
                      title={`Terminate run ${run.id}?`}
                      description="Steps that are running are interrupted. Assets they already materialized stay."
                    />
                  ) : (
                    <Act
                      iconOnly
                      icon="retry"
                      label="Re-execute"
                      title={`Re-execute run ${run.id}?`}
                      description={
                        run.failure
                          ? "All steps run again. To start at the failed step, open the run."
                          : "All steps run again with the same config."
                      }
                    />
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {rows.length ? (
          pager
        ) : (
          <Empty
            filtered
            onClear={() =>
              change({ state: "all", job: "", by: "", period: "", search: "" })
            }
          />
        )}
      </Panel>
    </>
  );
}
