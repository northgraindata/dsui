import type { PageNode } from "@northgraindata/dsui-plugin-sdk";
import { z } from "zod";
import { type ProjectOverview, projectOverviewSchema } from "../contract";
import { type Client, useResource } from "./client";
import { duration, StatusBadge, when } from "./format";
import { Project } from "./project";
import { React } from "./react";
import { RunButton } from "./run-button";
import { styles } from "./styles";

const nodeSchema = z.object({
  props: z.object({ projectId: z.string().optional() }),
});
const overviewSchema = z.array(projectOverviewSchema);

export function DexScreen({
  node,
  client,
}: {
  node: { props: PageNode["props"] };
  client: Client;
}) {
  const { projectId } = nodeSchema.parse(node.props).props;
  const overview = useResource(client, "overview", undefined, overviewSchema);
  const project = overview.data?.find((item) => item.id === projectId);
  const content = () => {
    if (!overview.data)
      return overview.error ? null : (
        <p role="status" className="dx-empty">
          Loading projects…
        </p>
      );
    if (project)
      return (
        <Project
          key={project.id}
          client={client}
          project={project}
          changed={overview.reload}
        />
      );
    if (projectId)
      return (
        <p className="dx-empty">
          Project unavailable.{" "}
          <button type="button" onClick={() => client.navigate?.("projects")}>
            Back to Dex projects
          </button>
        </p>
      );
    if (overview.data.length === 0)
      return (
        <p className="dx-empty">
          Add projects under plugins.dex.config.projects in dsui.yaml, then
          restart DSUI.
        </p>
      );
    return (
      <>
        <LatestResults client={client} projects={overview.data} />
        <ProjectList
          client={client}
          projects={overview.data}
          started={overview.reload}
        />
      </>
    );
  };
  return (
    <div className="dx-screen">
      <style>{styles}</style>
      {overview.error && (
        <p role="alert" className="dx-error">
          {overview.error}{" "}
          <button type="button" onClick={overview.reload}>
            Retry
          </button>
        </p>
      )}
      {content()}
    </div>
  );
}

function LatestResults({
  client,
  projects,
}: {
  client: Client;
  projects: readonly ProjectOverview[];
}) {
  return (
    <section className="dx-panel dx-results" aria-label="Latest check results">
      <div className="dx-heading">
        <h3>Latest check results</h3>
      </div>
      <div className="dx-table">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Result</th>
              <th>Finished</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(({ id, name, lastResult }) => {
              const problem = lastResult?.problem;
              const failed = lastResult?.failedStep;
              return (
                <tr key={id}>
                  <td>
                    <button
                      type="button"
                      className="dx-text-button"
                      onClick={() => client.navigate?.(`projects/${id}`)}
                    >
                      {name}
                    </button>
                  </td>
                  <td>
                    <StatusBadge run={lastResult?.run ?? null} />
                  </td>
                  <td>{when(lastResult?.run.finishedAt ?? null)}</td>
                  <td>
                    {lastResult?.run.message || "No completed run"}
                    {problem && (
                      <small>
                        {[problem.identifier ?? problem.axis, problem.column]
                          .filter(Boolean)
                          .join(".")}{" "}
                        · {problem.detail}
                      </small>
                    )}
                    {!problem && failed && (
                      <small>
                        {failed.label}
                        {failed.message ? ` · ${failed.message}` : ""}
                      </small>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProjectList({
  client,
  projects,
  started,
}: {
  client: Client;
  projects: readonly ProjectOverview[];
  started: () => void;
}) {
  return (
    <section className="dx-project-section" aria-label="Projects">
      <h3>Projects</h3>
      <div className="dx-projects">
        {projects.map((item) => (
          <article
            key={item.id}
            className="dx-card"
            data-status={item.lastRun?.status ?? "none"}
          >
            <div className="dx-heading">
              <h3>
                <button
                  type="button"
                  className="dx-card-link dx-text-button"
                  onClick={() => client.navigate?.(`projects/${item.id}`)}
                >
                  {item.name} <span aria-hidden="true">↗</span>
                </button>
              </h3>
              <StatusBadge run={item.lastRun} />
            </div>
            <p>
              {item.lastRun
                ? `Last run ${when(item.lastRun.createdAt)} · ${item.lastRun.trigger} · ${duration(item.lastRun)}`
                : "No runs yet"}
            </p>
            <p>
              {item.nextRunAt
                ? `Next scheduled run ${when(item.nextRunAt)}`
                : "No scheduled runs"}
            </p>
            <div className="dx-card-actions">
              <RunButton
                client={client}
                projectId={item.id}
                latest={item.lastRun}
                started={started}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
