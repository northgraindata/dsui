import { z } from "zod";
import {
  type ProjectOverview,
  runDetailSchema,
  runSummarySchema,
} from "../contract";
import { type Client, useResource } from "./client";
import { commandSummary } from "./command-picker";
import { DataTable, Diagram } from "./data";
import { Findings } from "./findings";
import { duration, StatusBadge, Steps, when } from "./format";
import { JsonOutput } from "./json-output";
import { OptionSelect } from "./option-select";
import { React } from "./react";
import { RunButton } from "./run-button";
import { Schedules } from "./schedules";

const runResponseSchema = z.object({ run: runDetailSchema.nullable() });
const historySchema = z.array(runSummarySchema);
const TABS = [
  ["runs", "Runs"],
  ["inventory", "Tables"],
  ["semantic", "Metrics"],
  ["diagram", "Diagram"],
  ["plans", "Plans"],
] as const;
type Tab = (typeof TABS)[number][0];
const FILTERS = [
  ["all", "All"],
  ["manual", "Manual"],
  ["scheduled", "Scheduled"],
] as const;

function History({
  client,
  projectId,
  selected,
  open,
}: {
  client: Client;
  projectId: string;
  selected?: string;
  open: (runId: string) => void;
}) {
  const { data, error, reload } = useResource(
    client,
    "runs",
    { projectId, limit: 100 },
    historySchema,
  );
  const [filter, setFilter] =
    React.useState<(typeof FILTERS)[number][0]>("all");
  const rows = data?.filter(
    (run) => filter === "all" || run.trigger === filter,
  );
  return (
    <section className="dx-panel" aria-label="Run history">
      <div className="dx-heading">
        <h3>Run history</h3>
        <OptionSelect
          ariaLabel="Filter by trigger"
          value={filter}
          options={FILTERS.map(([value, label]) => ({ value, label }))}
          onValueChange={(value) => {
            const option = FILTERS.find(([key]) => key === value);
            if (option) setFilter(option[0]);
          }}
        />
      </div>
      {error && (
        <p role="alert" className="dx-error">
          {error}{" "}
          <button type="button" onClick={reload}>
            Retry
          </button>
        </p>
      )}
      {!data && !error && <p role="status">Loading runs…</p>}
      {rows?.length === 0 && (
        <p>{data?.length ? "No matching runs." : "No runs yet."}</p>
      )}
      {!!rows?.length && (
        <div className="dx-table">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Status</th>
                <th>Trigger</th>
                <th>Duration</th>
                <th>Problems</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((run) => (
                <tr key={run.id} aria-current={run.id === selected}>
                  <td>
                    <button
                      type="button"
                      className="dx-text-button"
                      onClick={() => open(run.id)}
                    >
                      {when(run.startedAt ?? run.createdAt)}
                    </button>
                  </td>
                  <td>
                    <StatusBadge run={run} />
                  </td>
                  <td>
                    {run.trigger === "manual" ? "Manual" : "Scheduled"}
                    {run.scheduledFor && (
                      <small>Due {when(run.scheduledFor)}</small>
                    )}
                  </td>
                  <td>{duration(run)}</td>
                  <td>{run.problemCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RunDetails({
  client,
  projectId,
  selected,
  back,
}: {
  client: Client;
  projectId: string;
  selected?: string;
  back: () => void;
}) {
  const detail = useResource(
    client,
    "run",
    {
      projectId,
      limit: 500,
      ...(selected ? { runId: selected } : {}),
    },
    runResponseSchema,
  );
  const [tab, setTab] = React.useState<"result" | "json">("result");
  const run = detail.data?.run;
  return (
    <section className="dx-panel" aria-label="Run details">
      <div className="dx-heading">
        <h3>{selected ? "Run details" : "Latest run"}</h3>
        {selected && (
          <button type="button" onClick={back}>
            Back to latest
          </button>
        )}
      </div>
      {detail.error && (
        <p role="alert" className="dx-error">
          {detail.error}{" "}
          <button type="button" onClick={detail.reload}>
            Retry
          </button>
        </p>
      )}
      {!detail.data && !detail.error && <p role="status">Loading run…</p>}
      {detail.data && !run && (
        <p>
          {selected
            ? "This run is no longer available."
            : "Run a check to see the result here."}
        </p>
      )}
      {run && (
        <>
          <div className="dx-run-meta">
            <StatusBadge run={run} />
            <span>
              {when(run.startedAt ?? run.createdAt)} ·{" "}
              {run.trigger === "manual" ? "Manual" : "Scheduled"}
            </span>
            {run.message && <p>{run.message}</p>}
            {run.commands && <p>{commandSummary(run.commands)}</p>}
          </div>
          <nav className="dx-tabs" aria-label="Run detail view">
            <button
              type="button"
              aria-pressed={tab === "result"}
              onClick={() => setTab("result")}
            >
              Result
            </button>
            <button
              type="button"
              aria-pressed={tab === "json"}
              onClick={() => setTab("json")}
            >
              JSON
            </button>
          </nav>
          {tab === "result" ? (
            <>
              <Steps steps={run.steps} />
              <Findings key={run.id} run={run} />
            </>
          ) : (
            <JsonOutput key={run.id} client={client} run={run} />
          )}
        </>
      )}
    </section>
  );
}

export function Project({
  client,
  project,
  changed,
}: {
  client: Client;
  project: ProjectOverview;
  changed: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("runs");
  const [selected, setSelected] = React.useState<string>();
  const [requested, setRequested] = React.useState<{
    id: string;
    previousId: string | undefined;
  }>();
  const { id: projectId, lastRun } = project;
  const pending = requested && requested.previousId === lastRun?.id;
  const shown = selected ?? (pending ? requested.id : undefined);
  // Once overview advances, the latest-run resource can follow future runs.
  React.useEffect(() => {
    if (!pending && requested) setRequested(undefined);
  }, [pending, requested]);

  return (
    <>
      <button
        type="button"
        className="dx-back"
        onClick={() => client.navigate?.("projects")}
      >
        ← All projects
      </button>
      <section className="dx-hero" data-status={lastRun?.status ?? "none"}>
        <div>
          <div className="dx-title">
            <h2>{project.name}</h2>
            <StatusBadge run={lastRun} />
          </div>
          <p>
            {project.nextRunAt
              ? `Next scheduled run ${when(project.nextRunAt)}`
              : "No scheduled runs"}
          </p>
        </div>
        <RunButton
          client={client}
          projectId={projectId}
          latest={lastRun}
          started={(runId) => {
            setSelected(undefined);
            setRequested({ id: runId, previousId: lastRun?.id });
            setTab("runs");
            changed();
          }}
        />
      </section>
      <nav className="dx-tabs" aria-label="Dex project">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "runs" && (
        <div className="dx-run-layout">
          <div className="dx-run-main">
            <History
              client={client}
              projectId={projectId}
              selected={shown ?? lastRun?.id}
              open={setSelected}
            />
            <RunDetails
              client={client}
              projectId={projectId}
              selected={shown}
              back={() => {
                setSelected(undefined);
                setRequested(undefined);
              }}
            />
          </div>
          <Schedules client={client} projectId={projectId} changed={changed} />
        </div>
      )}
      {(tab === "inventory" || tab === "semantic" || tab === "plans") && (
        <DataTable key={tab} client={client} projectId={projectId} view={tab} />
      )}
      {tab === "diagram" && <Diagram client={client} projectId={projectId} />}
    </>
  );
}
