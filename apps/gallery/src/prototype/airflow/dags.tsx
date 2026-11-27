import { Tooltip } from "@northgraindata/dsui-ui";
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
import {
  type Dag,
  dags,
  isFailing,
  isRunning,
  minutesText,
  type State,
  stamp,
} from "./data";
import { Act, go, Header, Panel, stateLabel } from "./parts";
import { RunStrip } from "./run-strip";
import { Tags } from "./tags";

type Activity = "all" | "active" | "paused";
type Latest = "" | "failed" | "running";
type Sort = "name" | "recent" | "next";

const stateOf = (dag: Dag): State =>
  dag.paused ? "none" : (dag.runs.at(-1) ?? "none");

const sorts: Record<Sort, (a: Dag, b: Dag) => number> = {
  name: (a, b) => a.id.localeCompare(b.id),
  recent: (a, b) => b.lastRun.getTime() - a.lastRun.getTime(),
  next: (a, b) =>
    (a.nextRun?.getTime() ?? Infinity) - (b.nextRun?.getTime() ?? Infinity),
};

export function Dags({ query }: { query: URLSearchParams }) {
  // A link such as "all failing DAGs" sets the filter; otherwise keep the last.
  const requested = query.get("latest") as Latest | null;
  const [filters, setFilters] = useRemembered(
    `dags:filters:${requested ?? ""}`,
    {
      activity: "all" as Activity,
      latest: (requested ?? "") as Latest,
      search: "",
      tag: "",
      owner: "",
      sort: "name" as Sort,
    },
  );
  const set = (change: Partial<typeof filters>) =>
    setFilters({ ...filters, ...change });
  const clear = () =>
    set({ activity: "all", latest: "", search: "", tag: "", owner: "" });
  const needle = filters.search.trim().toLowerCase();
  const matching = dags.filter(
    (dag) =>
      (!needle || dag.id.includes(needle)) &&
      (!filters.tag || dag.tags.includes(filters.tag)) &&
      (!filters.owner || dag.owner === filters.owner),
  );
  const rows = matching
    .filter(
      (dag) =>
        filters.activity === "all" ||
        dag.paused === (filters.activity === "paused"),
    )
    .filter(
      (dag) =>
        !filters.latest ||
        (filters.latest === "failed" ? isFailing(dag) : isRunning(dag)),
    )
    .sort(sorts[filters.sort]);
  const { visible, pager } = usePages("dags", rows, JSON.stringify(filters));
  const filtered = Boolean(
    needle ||
      filters.tag ||
      filters.owner ||
      filters.latest ||
      filters.activity !== "all",
  );
  const head = (sort: Sort, label: string) => (
    <button
      type="button"
      aria-pressed={filters.sort === sort}
      onClick={() => set({ sort })}
    >
      {label}
      {filters.sort === sort ? " ↓" : ""}
    </button>
  );
  return (
    <>
      <Header art="dags" title="DAGs" />
      <Toolbar>
        <Segments
          label="Schedule"
          value={filters.activity}
          onChange={(activity) => set({ activity })}
          options={[
            { value: "all", label: "All", count: matching.length },
            {
              value: "active",
              label: "Active",
              count: matching.filter((dag) => !dag.paused).length,
            },
            {
              value: "paused",
              label: "Paused",
              count: matching.filter((dag) => dag.paused).length,
            },
          ]}
        />
        <Segments
          label="Latest run"
          value={filters.latest || "any"}
          onChange={(latest) => set({ latest: latest === "any" ? "" : latest })}
          options={[
            { value: "any", label: "Any run" },
            {
              value: "failed",
              label: "Failed",
              tone: "failed",
              count: matching.filter(isFailing).length,
            },
            {
              value: "running",
              label: "Running",
              tone: "running",
              count: matching.filter(isRunning).length,
            },
          ]}
        />
        <span className="ax-grow" />
        <Search
          label="Search DAGs"
          value={filters.search}
          onChange={(search) => set({ search })}
        />
        <Choice
          all="All tags"
          value={filters.tag}
          options={unique(dags.flatMap((dag) => dag.tags))}
          onChange={(tag) => set({ tag })}
        />
        <Choice
          all="All owners"
          value={filters.owner}
          options={unique(dags.map((dag) => dag.owner))}
          onChange={(owner) => set({ owner })}
        />
      </Toolbar>
      <Panel flush>
        <div className="ax-table ax-dag-table" data-dsui-scroll>
          <div className="ax-thead">
            <span />
            {head("name", "DAG")}
            <span>Owner</span>
            <span>Schedule</span>
            {head("recent", "Last run")}
            {head("next", "Next run")}
            <span>Recent runs</span>
            <span />
          </div>
          {visible.map((dag) => {
            const state = stateOf(dag);
            const label = dag.paused
              ? "Paused"
              : state === "running"
                ? "Running now"
                : `Latest run: ${stateLabel[state].toLowerCase()}`;
            return (
              // biome-ignore lint/a11y/useSemanticElements: the row holds buttons
              <div
                className="ax-tr"
                role="link"
                tabIndex={0}
                key={dag.id}
                onClick={() => go(`/dags/${dag.id}`)}
                onKeyDown={(event) =>
                  event.key === "Enter" && go(`/dags/${dag.id}`)
                }
              >
                <Tooltip label={label}>
                  <span
                    className="ax-status"
                    data-state={state}
                    role="img"
                    aria-label={label}
                  />
                </Tooltip>
                <span className="ax-name">
                  <strong data-paused={dag.paused}>{dag.id}</strong>
                  <Tags tags={dag.tags} onPick={(tag) => set({ tag })} />
                </span>
                <span>{dag.owner}</span>
                <code>{dag.schedule}</code>
                <span>
                  {stamp(dag.lastRun)}
                  <small>{minutesText(dag.minutes)}</small>
                </span>
                <span>
                  {dag.nextRun
                    ? stamp(dag.nextRun).replace("Today ", "Today ")
                    : "—"}
                </span>
                <RunStrip dag={dag} />
                <span className="ax-row-actions">
                  <Act
                    iconOnly
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
                    iconOnly
                    icon="bolt"
                    label="Trigger"
                    title={`Trigger ${dag.id}?`}
                    description="Starts a new run. A paused DAG is unpaused first."
                  />
                </span>
              </div>
            );
          })}
        </div>
        {rows.length ? null : <Empty filtered={filtered} onClear={clear} />}
        {pager}
      </Panel>
    </>
  );
}
