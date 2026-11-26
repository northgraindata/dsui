import {
  ago,
  minutesText,
  runStream,
  type State,
  type StreamRun,
  stamp,
} from "./data";
import {
  Choice,
  Empty,
  Search,
  Segments,
  Toolbar,
  usePages,
  useRemembered,
} from "./list";
import { Act, go, Header, Panel, Pill } from "./parts";

/** Airflow's `run_type` values. */
const runTypes: Record<string, string> = {
  scheduled: "Scheduled",
  manual: "Manual",
  backfill: "Backfill",
  asset_triggered: "Asset triggered",
  asset_materialization: "Asset materialization",
  operator_triggered: "Triggered by operator",
};
const ranges: Record<string, number> = {
  "Last 24 hours": 1440,
  "Last 7 days": 10_080,
  "Last 30 days": 43_200,
};
const states: State[] = ["running", "failed", "queued", "success"];
const names: Record<string, string> = {
  running: "Running",
  failed: "Failed",
  queued: "Queued",
  success: "Success",
};

export function Runs() {
  const [filters, setFilters] = useRemembered("runs:filters", {
    state: "all",
    search: "",
    type: "",
    range: "Last 24 hours",
  });
  const set = (change: Partial<typeof filters>) =>
    setFilters({ ...filters, ...change });
  const since = ago(ranges[filters.range] ?? 1440);
  const needle = filters.search.trim().toLowerCase();
  const matching = runStream.filter(
    (run) =>
      run.started >= since &&
      (!needle || run.dag.includes(needle)) &&
      (!filters.type || run.type === filters.type),
  );
  const rows = matching.filter(
    (run) => filters.state === "all" || run.state === filters.state,
  );
  const { visible, pager } = usePages<StreamRun>(
    "runs",
    rows,
    JSON.stringify(filters),
  );
  const longest = Math.max(1, ...visible.map((run) => run.minutes));
  return (
    <>
      <Header art="runs" title="Runs" />
      <Toolbar>
        <Segments
          label="State"
          value={filters.state}
          onChange={(state) => set({ state })}
          options={[
            { value: "all", label: "All", count: matching.length },
            ...states.map((state) => ({
              value: state as string,
              label: names[state] ?? state,
              tone: state,
              count: matching.filter((run) => run.state === state).length,
            })),
          ]}
        />
        <span className="ax-grow" />
        <Search
          label="Search by DAG"
          value={filters.search}
          onChange={(search) => set({ search })}
        />
        <Choice
          all="All run types"
          value={filters.type}
          options={Object.keys(runTypes)}
          names={runTypes}
          onChange={(type) => set({ type })}
        />
        <Choice
          all="Last 24 hours"
          value={filters.range === "Last 24 hours" ? "" : filters.range}
          options={["Last 7 days", "Last 30 days"]}
          onChange={(range) => set({ range: range || "Last 24 hours" })}
        />
      </Toolbar>
      <Panel flush>
        <div className="ax-table ax-run-table" data-dsui-scroll>
          <div className="ax-thead">
            <span>State</span>
            <span>DAG</span>
            <span>Type</span>
            <span>Started</span>
            <span>Duration</span>
            <span />
          </div>
          {visible.map((run) => (
            // biome-ignore lint/a11y/useSemanticElements: the row holds buttons
            <div
              className="ax-tr"
              role="link"
              tabIndex={0}
              key={run.id}
              onClick={() => go(`/dags/${run.dag}`)}
              onKeyDown={(event) =>
                event.key === "Enter" && go(`/dags/${run.dag}`)
              }
            >
              <Pill state={run.state} />
              <strong>{run.dag}</strong>
              <span>{runTypes[run.type]}</span>
              <span>{stamp(run.started)}</span>
              <span className="ax-duration">
                <i
                  data-state={run.state}
                  style={{ width: `${(run.minutes / longest) * 100}%` }}
                />
                <small>
                  {run.state === "queued"
                    ? "waiting"
                    : run.state === "running"
                      ? `${minutesText(run.minutes)} so far`
                      : minutesText(run.minutes)}
                </small>
              </span>
              <span className="ax-row-actions">
                {run.state === "failed" ? (
                  <Act
                    iconOnly
                    icon="retry"
                    label="Retry"
                    title={`Retry the failed tasks of ${run.dag}?`}
                    description="Clears only the failed task instances, so Airflow runs them again."
                  />
                ) : null}
                {run.state === "running" || run.state === "queued" ? (
                  <Act
                    iconOnly
                    icon="stop"
                    label="Terminate"
                    title={`Terminate this run of ${run.dag}?`}
                    description="The run is marked as failed."
                  />
                ) : null}
              </span>
            </div>
          ))}
        </div>
        {rows.length ? null : (
          <Empty
            filtered
            onClear={() =>
              set({ state: "all", search: "", type: "", range: "Last 30 days" })
            }
          />
        )}
        {pager}
      </Panel>
    </>
  );
}
