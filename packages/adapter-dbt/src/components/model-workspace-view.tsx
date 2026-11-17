import {
  CodeBlock,
  type ComponentProps,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import { DataTable } from "@northgraindata/dsui-ui";
import { useId, useState } from "react";
import { DependencyGraph } from "./dependency-graph";
import {
  type ModelDetail,
  modelDetailSchema,
  ResourceNotice,
  sourceSchema,
  useWorkspaceResource,
  WorkspaceTabs,
} from "./workspace-shared";
import type { WorkspaceSource } from "./workspace";
import { workspaceStyles } from "./workspace-styles";
const propsSchema = z.object({
  modelId: z.string(),
  source: sourceSchema,
  lineageSource: sourceSchema,
});
const tabs = [
  { id: "columns", label: "Columns" },
  { id: "source", label: "Source SQL" },
  { id: "compiled", label: "Compiled SQL" },
  { id: "lineage", label: "Lineage" },
] as const;
export default function ModelWorkspaceView({
  client,
  node,
  renderNode,
}: ComponentProps) {
  const props = propsSchema.parse(node.props.props);
  const result = useWorkspaceResource(client, props.source, modelDetailSchema);
  return (
    <section className="dbt-workspace">
      <style>{workspaceStyles}</style>
      <button
        className="dbt-back"
        type="button"
        onClick={() => client.navigate("/models")}
      >
        <span aria-hidden="true">←</span>All models
      </button>
      {result.data ? (
        <ModelWorkspaceContent
          client={client}
          renderNode={renderNode}
          model={result.data}
          lineageSource={props.lineageSource}
        />
      ) : (
        <ResourceNotice
          error={result.error}
          retry={result.retry}
          label="model details"
        />
      )}
    </section>
  );
}
export function ModelWorkspaceContent({
  client,
  renderNode,
  model,
  lineageSource,
}: Pick<ComponentProps, "client" | "renderNode"> & {
  model: ModelDetail;
  lineageSource: WorkspaceSource;
}) {
  const id = useId();
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("columns");
  const relation = [model.database, model.schema, model.alias || model.name]
    .filter(Boolean)
    .join(".");
  const upstream = model.dependencies.filter((dependency) =>
    dependency.startsWith("model."),
  );
  return (
    <>
      <header className="dbt-heading">
        <div>
          <span className="dbt-eyebrow">dbt model</span>
          <h1>{model.name}</h1>
          {model.description && <p>{model.description}</p>}
        </div>
      </header>
      <div className="dbt-model-context">
        <span>
          <strong>Relation</strong>
          <code>{relation || "Not specified"}</code>
        </span>
        <span>{model.columns.length} columns</span>
        <span>{model.dependencies.length} upstream dependencies</span>
      </div>
      <div className="dbt-model-layout">
        <main className="dbt-model-main">
          <WorkspaceTabs
            id={id}
            label="Model details"
            items={tabs}
            value={tab}
            onChange={setTab}
          />
          <div
            id={`${id}-panel`}
            role="tabpanel"
            aria-labelledby={`${id}-${tab}`}
          >
            {tab === "columns" ? (
              model.columns.length ? (
                <div className="dbt-columns">
                  <DataTable
                    columns={[
                      { id: "name", label: "Column" },
                      { id: "dataType", label: "Data type" },
                      { id: "description", label: "Description" },
                    ]}
                    rows={model.columns}
                    renderCell={(column, value) =>
                      column === "name" || column === "dataType" ? (
                        <code>{value ? String(value) : "—"}</code>
                      ) : (
                        <span className="dbt-column-description">
                          {value ? String(value) : "No description"}
                        </span>
                      )
                    }
                  />
                </div>
              ) : (
                <div className="dbt-empty">
                  <h2>No documented columns</h2>
                  <p>
                    Add column definitions to your model's YAML file and publish
                    the updated manifest.
                  </p>
                </div>
              )
            ) : tab === "lineage" ? (
              <>
                <div className="dbt-section-heading">
                  <h2>Model lineage</h2>
                  <p>
                    Upstream dependencies and downstream models connected to{" "}
                    {model.name}.
                  </p>
                </div>
                {renderNode(
                  client,
                  DependencyGraph({
                    source: lineageSource,
                    idField: "graphId",
                    dependsOnField: "upstreamGraphIds",
                    labelField: "name",
                    detailField: "detail",
                    stateField: "state",
                  }),
                )}
              </>
            ) : (
              <div>
                {(tab === "source" ? model.rawCode : model.compiledCode) ? (
                  renderNode(
                    client,
                    CodeBlock({
                      label: tab === "source" ? "Source SQL" : "Compiled SQL",
                      value:
                        tab === "source" ? model.rawCode : model.compiledCode,
                      language: "sql",
                    }),
                  )
                ) : (
                  <div className="dbt-empty">
                    <h2>
                      {tab === "source"
                        ? "Source SQL is unavailable"
                        : "Compiled SQL is unavailable"}
                    </h2>
                    <p>
                      {tab === "source"
                        ? "The current manifest does not include source SQL for this model."
                        : "Compile or build the project, then publish a manifest containing compiled_code."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
        <aside className="dbt-model-aside" aria-label="Model metadata">
          <h2>Model details</h2>
          <dl>
            <div>
              <dt>Unique ID</dt>
              <dd>
                <code>{model.uniqueId}</code>
              </dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>{model.database || "Not specified"}</dd>
            </div>
            <div>
              <dt>Schema</dt>
              <dd>{model.schema || "Not specified"}</dd>
            </div>
            <div>
              <dt>Alias</dt>
              <dd>{model.alias || model.name}</dd>
            </div>
            <div>
              <dt>Upstream models</dt>
              <dd>
                {upstream.length ? (
                  <ul>
                    {upstream.map((dependency) => (
                      <li key={dependency}>
                        <button
                          className="dbt-dependency"
                          type="button"
                          title={dependency}
                          onClick={() =>
                            client.navigate(
                              `/models/${encodeURIComponent(dependency)}`,
                            )
                          }
                        >
                          {dependency.split(".").slice(2).join(".") ||
                            dependency}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  "No upstream models"
                )}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}
