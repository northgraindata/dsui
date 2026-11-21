import { type ComponentProps, z } from "@northgraindata/dsui-adapter-sdk";
import {
  Button,
  DataTable,
  Input,
  OptionSelect,
} from "@northgraindata/dsui-ui";
import { useId, useMemo, useState } from "react";
import { ModelKindIcon, materializationLabel } from "./model-icons";
import { ModelLink } from "./model-link";
import { DependencyGraph } from "./dependency-graph";
import {
  modelRowSchema,
  type ModelRow,
  ResourceNotice,
  sourceSchema,
  useWorkspaceResource,
  WorkspaceTabs,
} from "./workspace-shared";
import { workspaceStyles } from "./workspace-styles";
const propsSchema = z.object({ source: sourceSchema });
const rowsSchema = z.array(modelRowSchema);
const tabs = [
  { id: "models", label: "Models" },
  { id: "lineage", label: "Lineage" },
] as const;
const columns = [
  { id: "name", label: "Model" },
  { id: "location", label: "Location" },
  { id: "dependsOn", label: "Dependencies" },
];
export function filterModels(
  models: readonly ModelRow[],
  search: string,
  materialized: string,
  pkg: string,
) {
  const term = search.trim().toLocaleLowerCase();
  return models
    .filter(
      (model) =>
        (!materialized || model.materialized === materialized) &&
        (!pkg || model.package === pkg) &&
        (!term ||
          [
            model.name,
            model.description,
            model.location,
            model.package,
            model.uniqueId,
          ].some((value) => value.toLocaleLowerCase().includes(term))),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}
export default function ModelCatalogView({
  client,
  node,
  renderNode,
}: ComponentProps) {
  const props = propsSchema.parse(node.props.props);
  const result = useWorkspaceResource(client, props.source, rowsSchema);
  return (
    <section className="dbt-workspace">
      <style>{workspaceStyles}</style>
      <header className="dbt-heading">
        <div>
          <span className="dbt-eyebrow">dbt catalog</span>
          <h1>Models</h1>
          <p>
            Explore transformations, inspect their columns and trace
            dependencies.
          </p>
        </div>
      </header>
      {result.data ? (
        <ModelCatalogContent
          {...{ client, node, renderNode }}
          models={result.data}
          source={props.source}
        />
      ) : (
        <ResourceNotice
          error={result.error}
          retry={result.retry}
          label="models"
        />
      )}
    </section>
  );
}
export function ModelCatalogContent({
  client,
  renderNode,
  models,
  source,
}: Pick<ComponentProps, "client" | "renderNode"> & {
  models: readonly ModelRow[];
  source: z.infer<typeof sourceSchema>;
}) {
  const id = useId();
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("models");
  const [search, setSearch] = useState("");
  const [materialized, setMaterialized] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(
    () => filterModels(models, search, materialized, ""),
    [models, search, materialized],
  );
  const size = 25,
    totalPages = Math.max(1, Math.ceil(filtered.length / size)),
    currentPage = Math.min(page, totalPages - 1);
  const options = (field: "materialized" | "package", label: string) => [
    { value: "", label },
    ...[...new Set(models.map((model) => model[field]).filter(Boolean))]
      .sort()
      .map((value) => ({
        value,
        label: field === "materialized" ? materializationLabel(value) : value,
      })),
  ];
  const reset = () => {
    setSearch("");
    setMaterialized("");
    setPage(0);
  };
  const rows = filtered.slice(currentPage * size, (currentPage + 1) * size);
  const byId = new Map(models.map((model) => [model.uniqueId, model]));
  return (
    <>
      <WorkspaceTabs
        id={id}
        label="Model catalog views"
        items={tabs}
        value={tab}
        onChange={setTab}
      />
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`}>
        {tab === "lineage" ? (
          <>
            <div className="dbt-section-heading">
              <h2>Project lineage</h2>
              <p>
                All models in the manifest. Select a node to inspect its
                dependencies.
              </p>
            </div>
            {renderNode(
              client,
              DependencyGraph({
                source,
                idField: "uniqueId",
                dependsOnField: "dependsOn",
                labelField: "name",
                detailField: "materialized",
                rowLink: {
                  path: "/models/:modelId",
                  params: { modelId: "uniqueId" },
                },
              }),
            )}
          </>
        ) : (
          <div className="dbt-model-main">
            <div className="dbt-toolbar">
              <span className="dbt-result-count" role="status">
                {filtered.length === models.length
                  ? `${models.length.toLocaleString()} models`
                  : `${filtered.length.toLocaleString()} of ${models.length.toLocaleString()} models`}
              </span>
              <div className="dbt-filters">
                <Input
                  className="dbt-search"
                  type="search"
                  aria-label="Search models"
                  placeholder="Search models, descriptions, relations…"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(0);
                  }}
                />
                <OptionSelect
                  className="dbt-select"
                  ariaLabel="Materialization"
                  value={materialized}
                  options={options("materialized", "All materializations")}
                  onValueChange={(value) => {
                    setMaterialized(value);
                    setPage(0);
                  }}
                />
                {(search || materialized) && (
                  <Button variant="ghost" size="small" onClick={reset}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            {rows.length ? (
              <div className="dbt-models-table">
                <DataTable
                  columns={columns}
                  rows={rows}
                  renderCell={(column, value, row) => {
                    const model = modelRowSchema.parse(row);
                    if (column === "name")
                      return (
                        <ModelLink
                          client={client}
                          id={model.uniqueId}
                          className="dbt-model-link"
                        >
                          <ModelKindIcon kind={model.materialized} />
                          <span className="dbt-model-copy">
                            <span className="dbt-model-name">{model.name}</span>
                            {model.description && (
                              <span
                                className="dbt-model-description"
                                title={model.description}
                              >
                                {model.description}
                              </span>
                            )}
                          </span>
                        </ModelLink>
                      );
                    if (column === "location")
                      return model.location &&
                        model.materialized !== "ephemeral" ? (
                        <ModelLink
                          client={client}
                          id={model.uniqueId}
                          className="dbt-location-link"
                          label={`Inspect ${model.name} in ${model.location}`}
                        >
                          <code>{model.location}</code>
                          <span aria-hidden="true">↗</span>
                        </ModelLink>
                      ) : (
                        <span className="dbt-cell-muted">
                          {model.materialized === "ephemeral"
                            ? "Not materialized"
                            : "Not specified"}
                        </span>
                      );
                    if (column === "dependsOn") {
                      if (!model.dependsOn.length)
                        return (
                          <span className="dbt-cell-muted">
                            No dependencies
                          </span>
                        );
                      const dependency = (id: string) => {
                        const name =
                          byId.get(id)?.name ??
                          (id.split(".").slice(2).join(".") || id);
                        return id.startsWith("model.") ? (
                          <ModelLink
                            key={id}
                            client={client}
                            id={id}
                            className="dbt-dependency-chip"
                            label={`Open upstream model ${name}`}
                          >
                            {name}
                          </ModelLink>
                        ) : (
                          <span
                            className="dbt-dependency-chip"
                            key={id}
                            title={id}
                          >
                            {name}
                          </span>
                        );
                      };
                      return (
                        <div className="dbt-dependencies">
                          {model.dependsOn.slice(0, 2).map(dependency)}
                          {model.dependsOn.length > 2 && (
                            <details className="dbt-dependencies-more">
                              <summary
                                aria-label={`Show ${model.dependsOn.length - 2} more dependencies`}
                              >
                                +{model.dependsOn.length - 2}
                              </summary>
                              <div>
                                {model.dependsOn.slice(2).map(dependency)}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    }
                    return value === undefined || value === ""
                      ? "—"
                      : String(value);
                  }}
                />
              </div>
            ) : (
              <div className="dbt-empty">
                <h2>
                  {models.length ? "No matching models" : "No models available"}
                </h2>
                <p>
                  {models.length
                    ? "Try another search or clear your filters."
                    : "Publish a manifest.json artifact to browse your dbt models."}
                </p>
                {models.length > 0 && (
                  <Button variant="secondary" size="small" onClick={reset}>
                    Clear filters
                  </Button>
                )}
              </div>
            )}
            {filtered.length > size && (
              <footer className="dbt-pagination">
                <span>
                  {currentPage * size + 1}–
                  {Math.min((currentPage + 1) * size, filtered.length)} of{" "}
                  {filtered.length.toLocaleString()} models
                </span>
                <div>
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={currentPage === totalPages - 1}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </footer>
            )}
          </div>
        )}
      </div>
    </>
  );
}
