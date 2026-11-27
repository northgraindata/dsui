/* Jobs, and one job's graph, runs and launchpad. */
import { Button, notify } from "@northgraindata/dsui-ui";
import { useState } from "react";
import { Glyph } from "../shared/glyphs";
import {
  Choice,
  Empty,
  Search,
  Toolbar,
  unique,
  usePages,
  useRemembered,
} from "../shared/list";
import { go, IconButton, Panel, Tabs } from "../shared/ui";
import { assetNow, assetStates } from "./catalog";
import { type JobDef, jobs } from "./jobs";
import { Lineage } from "./lineage";
import { instigators } from "./ops";
import { Dot, Header, runPath } from "./parts";
import { RunTable } from "./run-table";
import { runs } from "./runs";
import { runStates } from "./states";
import { RunStrip } from "./strips";
import { stamp } from "./time";

const runsOf = (job: JobDef) => runs.filter((run) => run.job === job.name);
const automationOf = (job: JobDef) =>
  instigators.filter((item) => item.job === job.name);

export function Jobs() {
  const [filters, setFilters] = useRemembered("dx:jobs", {
    search: "",
    location: "",
  });
  const rows = jobs.filter(
    (job) =>
      job.name.includes(filters.search.toLowerCase()) &&
      (!filters.location || job.location === filters.location),
  );
  const { visible, pager } = usePages("dx:jobs", rows, JSON.stringify(filters));
  return (
    <>
      <Header art="jobs" title="Jobs" />
      <Toolbar>
        <Search
          label="Search jobs"
          value={filters.search}
          onChange={(search) => setFilters({ ...filters, search })}
        />
        <Choice
          all="All code locations"
          value={filters.location}
          options={unique(jobs.map((job) => job.location))}
          onChange={(location) => setFilters({ ...filters, location })}
        />
      </Toolbar>
      <Panel flush>
        <div className="ax-table dx-job-table" data-dsui-scroll>
          <div className="ax-thead">
            <span />
            <span>Job</span>
            <span>Triggered by</span>
            <span>Latest run</span>
            <span>Recent runs</span>
            <span />
          </div>
          {visible.map((job) => {
            const own = runsOf(job);
            const latest = own[0];
            const [label, tone] = latest
              ? runStates[latest.status]
              : ["No runs", "none"];
            const triggers = automationOf(job);
            return (
              // biome-ignore lint/a11y/useSemanticElements: the row holds buttons
              <div
                className="ax-tr"
                role="link"
                tabIndex={0}
                key={job.name}
                onClick={() => go(`/jobs/${job.name}`)}
                onKeyDown={(event) =>
                  event.key === "Enter" &&
                  event.target === event.currentTarget &&
                  go(`/jobs/${job.name}`)
                }
              >
                <Dot tone={tone} label={label} />
                <span className="dx-two">
                  <strong>{job.name}</strong>
                  <small title={job.description}>{job.description}</small>
                </span>
                <span className="dx-two">
                  <span>
                    {job.cronText ??
                      (triggers.length ? "Sensor" : "Manual only")}
                  </span>
                  <small data-stale={triggers.some((item) => !item.running)}>
                    {triggers
                      .map(
                        (item) =>
                          `${item.kind === "schedule" ? "Schedule" : item.name}${item.running ? "" : " stopped"}`,
                      )
                      .join(", ")}
                  </small>
                </span>
                <span className="dx-two">
                  <span>{latest ? stamp(latest.created) : "—"}</span>
                  <small>{latest ? label : ""}</small>
                </span>
                <RunStrip runs={own} />
                {/* biome-ignore lint/a11y/noStaticElementInteractions: only stops the row from opening */}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the row from opening */}
                <span
                  className="ax-row-actions"
                  onClick={(event) => event.stopPropagation()}
                >
                  <IconButton
                    icon="play"
                    label={`Launch ${job.name}`}
                    onClick={() => go(`/jobs/${job.name}?tab=Launchpad`)}
                  />
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
            onClear={() => setFilters({ search: "", location: "" })}
          />
        )}
      </Panel>
    </>
  );
}

const defaultConfig = (job: JobDef) =>
  `ops:\n  ${job.name}:\n    config:\n      target: prod\n      full_refresh: false\nexecution:\n  config:\n    max_concurrent: 4\n`;

/** The config a run is launched with, with the few checks YAML needs. */
function Launchpad({ job }: { job: JobDef }) {
  const [config, setConfig] = useState(() => defaultConfig(job));
  const [tags, setTags] = useState("");
  const tabbed = config.split("\n").findIndex((line) => /^ *\t/.test(line));
  const problem =
    tabbed >= 0 ? `Line ${tabbed + 1}: YAML cannot be indented with tabs.` : "";
  const lines = config.split("\n").length;
  return (
    <div className="dx-launchpad">
      <div className="ax-code dx-editor">
        <pre className="ax-code-numbers" aria-hidden="true">
          {Array.from({ length: lines }, (_, index) => index + 1).join("\n")}
        </pre>
        <textarea
          aria-label="Run config YAML"
          spellCheck={false}
          rows={Math.max(12, lines)}
          value={config}
          onChange={(event) => setConfig(event.target.value)}
        />
      </div>
      <aside>
        <div className="ax-field">
          <span>Run tags (optional)</span>
          <input
            className="dx-input"
            aria-label="Run tags"
            placeholder="team=finance, reason=backfix"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
        </div>
        {problem ? (
          <p className="dx-warning">
            <Glyph name="alert" size={14} />
            {problem}
          </p>
        ) : null}
        <Button
          disabled={Boolean(problem)}
          onClick={() => notify.success(`${job.name} launched (prototype)`)}
        >
          <Glyph name="play" />
          Launch run
        </Button>
        <Button
          variant="secondary"
          onClick={() => setConfig(defaultConfig(job))}
        >
          Reset to defaults
        </Button>
      </aside>
    </div>
  );
}

function Ops({ job }: { job: JobDef }) {
  const latest = runsOf(job)[0];
  return (
    <Panel title="Ops">
      <ol className="dx-ops">
        {(job.ops ?? []).map((op) => (
          <li key={op}>
            <span>
              <Glyph name="sql" size={14} />
              <code>{op}</code>
            </span>
          </li>
        ))}
      </ol>
      {latest ? (
        <button
          type="button"
          className="ax-link"
          onClick={() => go(runPath(latest.id))}
        >
          Latest run {latest.id}
        </button>
      ) : null}
    </Panel>
  );
}

export function JobPage({
  job,
  query,
}: {
  job: JobDef;
  query: URLSearchParams;
}) {
  const tabs = ["Overview", "Runs", "Launchpad"];
  const wanted = query.get("tab") ?? "";
  const [tab, setTab] = useState(tabs.includes(wanted) ? wanted : "Overview");
  const items = job.assets
    .map((key) => assetNow.get(key))
    .filter((item) => item !== undefined);
  const states = (Object.keys(assetStates) as (keyof typeof assetStates)[])
    .map(
      (state) =>
        [state, items.filter((item) => item.state === state).length] as const,
    )
    .filter(([, count]) => count);
  return (
    <>
      <Header
        art="jobs"
        title={job.name}
        crumbs={[["Jobs", "/jobs"]]}
        subtitle={job.description}
        meta={
          <>
            <span className="ax-chip">{job.location}</span>
            {job.cronText ? <span>{job.cronText}</span> : null}
            {automationOf(job).map((item) => (
              <button
                type="button"
                className="ax-link"
                key={item.name}
                onClick={() => go(`/automation/${item.name}`)}
              >
                {item.name}
                {item.running ? "" : " (stopped)"}
              </button>
            ))}
            {job.pool ? <span>Pool {job.pool}</span> : null}
          </>
        }
        actions={
          <Button onClick={() => setTab("Launchpad")}>
            <Glyph name="play" />
            Launch run
          </Button>
        }
      />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "Overview" ? (
        <>
          <Panel
            title="Recent runs"
            aside={
              <span className="ax-legend">
                {states.map(([state, count]) => (
                  <span key={state}>
                    <Dot tone={assetStates[state][1]} />
                    {count} {assetStates[state][0].toLowerCase()}
                  </span>
                ))}
              </span>
            }
          >
            <RunStrip runs={runsOf(job)} />
          </Panel>
          {job.ops ? (
            <Ops job={job} />
          ) : (
            <Lineage stateKey={`job:${job.name}`} only={job.assets} openAll />
          )}
        </>
      ) : null}
      {tab === "Runs" ? (
        <RunTable id={`job:${job.name}`} runs={runsOf(job)} fixedJob />
      ) : null}
      {tab === "Launchpad" ? <Launchpad job={job} /> : null}
    </>
  );
}
