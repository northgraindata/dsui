import { Fragment } from "react";
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
import { ago, clock, dayLabel, eventLog, type LogEvent } from "./data";
import { go, Header, Panel } from "./parts";

const ranges: Record<string, number> = {
  "Last 24 hours": 1440,
  "Last 7 days": 10_080,
};
const tone: Record<string, string> = {
  failed: "failed",
  success: "success",
  running: "running",
};
const isPerson = (event: LogEvent) => event.who !== "airflow";

/** The event log, whole or for one DAG; Airflow filters it by `dag_id`. */
export function ActivityLog({ dag }: { dag?: string }) {
  const events = dag ? eventLog.filter((item) => item.dag === dag) : eventLog;
  const key = dag ? `activity:${dag}` : "activity";
  const [filters, setFilters] = useRemembered(`${key}:filters`, {
    actor: "all",
    search: "",
    event: "",
    user: "",
    range: "",
  });
  const set = (change: Partial<typeof filters>) =>
    setFilters({ ...filters, ...change });
  const needle = filters.search.trim().toLowerCase();
  const since = filters.range ? ago(ranges[filters.range] ?? 0) : undefined;
  const matching = events.filter(
    (item) =>
      (!since || item.at >= since) &&
      (!needle || item.dag.includes(needle) || item.task.includes(needle)) &&
      (!filters.event || item.event === filters.event) &&
      (!filters.user || item.who === filters.user),
  );
  const rows = matching.filter(
    (item) =>
      filters.actor === "all" ||
      isPerson(item) === (filters.actor === "people"),
  );
  const { visible, pager } = usePages(
    "activity",
    rows,
    JSON.stringify(filters),
  );
  return (
    <>
      <Toolbar>
        <Segments
          label="Who"
          value={filters.actor}
          onChange={(actor) => set({ actor })}
          options={[
            { value: "all", label: "Everything", count: matching.length },
            {
              value: "people",
              label: "By people",
              count: matching.filter(isPerson).length,
            },
            {
              value: "system",
              label: "By Airflow",
              count: matching.filter((item) => !isPerson(item)).length,
            },
          ]}
        />
        <span className="ax-grow" />
        <Search
          label={dag ? "Search task" : "Search DAG or task"}
          value={filters.search}
          onChange={(search) => set({ search })}
        />
        <Choice
          all="All events"
          value={filters.event}
          options={unique(events.map((item) => item.event))}
          onChange={(event) => set({ event })}
        />
        <Choice
          all="All users"
          value={filters.user}
          options={unique(events.map((item) => item.who))}
          onChange={(user) => set({ user })}
        />
        <Choice
          all="Any time"
          value={filters.range}
          options={Object.keys(ranges)}
          onChange={(range) => set({ range })}
        />
      </Toolbar>
      <Panel flush>
        <div
          className="ax-table ax-log-table"
          data-one-dag={Boolean(dag)}
          data-dsui-scroll
        >
          <div className="ax-thead">
            <span>Time</span>
            <span>Who</span>
            <span>Event</span>
            {dag ? null : <span>DAG</span>}
            <span>Task</span>
          </div>
          {visible.map((item, index) => {
            const label = dayLabel(item.at);
            const before = visible[index - 1];
            return (
              <Fragment key={item.id}>
                {before && dayLabel(before.at) === label ? null : (
                  <p className="ax-day">{label}</p>
                )}
                <div className="ax-tr">
                  <time dateTime={item.at.toISOString()}>{clock(item.at)}</time>
                  <button
                    type="button"
                    className="ax-who"
                    onClick={() => set({ user: item.who })}
                  >
                    {isPerson(item) ? (
                      <span className="ax-avatar">{item.who.slice(0, 2)}</span>
                    ) : null}
                    {item.who}
                  </button>
                  <button
                    type="button"
                    onClick={() => set({ event: item.event })}
                  >
                    {tone[item.event] ? (
                      <i className="ax-dot" data-state={tone[item.event]} />
                    ) : null}
                    <code>{item.event}</code>
                  </button>
                  {dag ? null : item.dag ? (
                    <button
                      type="button"
                      className="ax-link"
                      onClick={() => go(`/dags/${item.dag}`)}
                    >
                      {item.dag}
                    </button>
                  ) : (
                    <span>—</span>
                  )}
                  <span>{item.task || "—"}</span>
                </div>
              </Fragment>
            );
          })}
        </div>
        {rows.length ? null : (
          <Empty
            filtered
            onClear={() =>
              set({ actor: "all", search: "", event: "", user: "", range: "" })
            }
          />
        )}
        {pager}
      </Panel>
    </>
  );
}

export function Activity() {
  return (
    <>
      <Header art="activity" title="Activity" />
      <ActivityLog />
    </>
  );
}
