import { useCallback, useEffect, useState } from "react";
import { executeResource, getServices, type Service } from "../../api";
import { Icon } from "../../components/icon";
import {
  type DashboardDefinition,
  listDashboards,
  listModules,
  listResources,
  type ModuleDefinition,
  type ResourceOption,
  type Saved,
  saveDashboard,
  saveModule,
} from "./api";
import { Visualization } from "./visualization";
import "./analytics.css";

const blankModule: ModuleDefinition = {
  name: "",
  title: "",
  description: "",
  source: { serviceId: "", resourceId: "", input: {}, rowsPath: "" },
  chart: { type: "line", x: "", y: "", unit: "" },
  styles: { accentColor: "#377dff", height: "regular", showGrid: true },
};
const blankDashboard: DashboardDefinition = {
  name: "",
  title: "",
  description: "",
  styles: { columns: 2, spacing: "regular" },
  modules: [],
};

function keyOf(module: { name?: string; module?: string; subfolder?: string }) {
  return `${module.subfolder ?? ""}/${module.name ?? module.module ?? ""}`;
}
function slug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

function ModuleCard({
  module,
  onEdit,
}: {
  module: Saved<ModuleDefinition>;
  onEdit(): void;
}) {
  const [data, setData] = useState<unknown>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(() => {
    setLoading(true);
    setError("");
    executeResource(
      module.source.serviceId,
      module.source.resourceId,
      module.source.input,
    )
      .then((result) => setData(result.data))
      .catch((cause) => setError(errorText(cause)))
      .finally(() => setLoading(false));
  }, [module.source.serviceId, module.source.resourceId, module.source.input]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return (
    <article
      className={`analytics-card analytics-card--${module.styles.height}`}
      style={{ borderTopColor: module.styles.accentColor }}
    >
      <header>
        <div>
          <h3>{module.title}</h3>
          <p>{module.description}</p>
        </div>
        <div className="analytics-card-actions">
          <button
            type="button"
            onClick={refresh}
            aria-label={`Refresh ${module.title}`}
            title="Refresh"
          >
            <Icon name="refresh" size={16} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${module.title}`}
            title="Edit module"
          >
            <Icon name="gear" size={16} />
          </button>
        </div>
      </header>
      {loading && data === undefined ? (
        <div className="analytics-empty-visual">Loading data…</div>
      ) : error ? (
        <div className="analytics-error">{error}</div>
      ) : (
        <Visualization definition={module} data={data} />
      )}
      <footer>
        {module.source.serviceId} · {module.source.resourceId}
      </footer>
    </article>
  );
}

export function AnalyticsScreen() {
  const [modules, setModules] = useState<Array<Saved<ModuleDefinition>>>([]);
  const [dashboards, setDashboards] = useState<
    Array<Saved<DashboardDefinition>>
  >([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState("");
  const [dashboardDraft, setDashboardDraft] =
    useState<DashboardDefinition | null>(null);
  const [dashboardRevision, setDashboardRevision] = useState<string | null>(
    null,
  );
  const [moduleDraft, setModuleDraft] = useState<ModuleDefinition | null>(null);
  const [moduleRevision, setModuleRevision] = useState<string | null>(null);
  const [inputJson, setInputJson] = useState("{}");
  const [sqlText, setSqlText] = useState("");
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const [nextModules, nextDashboards, nextServices] = await Promise.all([
        listModules(),
        listDashboards(),
        getServices(),
      ]);
      setModules(nextModules);
      setDashboards(nextDashboards);
      setServices(nextServices);
      setSelected((current) =>
        nextDashboards.some((item) => item.name === current)
          ? current
          : (nextDashboards[0]?.name ?? ""),
      );
      setError("");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!moduleDraft?.source.serviceId) {
      setResources([]);
      return;
    }
    let active = true;
    listResources(moduleDraft.source.serviceId)
      .then((items) => {
        if (active) setResources(items);
      })
      .catch((cause) => {
        if (active) setError(errorText(cause));
      });
    return () => {
      active = false;
    };
  }, [moduleDraft?.source.serviceId]);

  const dashboard = dashboards.find((item) => item.name === selected);
  const openDashboard = (value?: Saved<DashboardDefinition>) => {
    setDashboardDraft(
      value
        ? {
            name: value.name,
            title: value.title,
            description: value.description,
            styles: { ...value.styles },
            modules: value.modules.map((item) => ({ ...item })),
          }
        : { ...blankDashboard, modules: [] },
    );
    setDashboardRevision(value?.revision ?? null);
    setModuleDraft(null);
    setError("");
  };
  const openModule = (value?: Saved<ModuleDefinition>) => {
    const draft = value
      ? {
          name: value.name,
          subfolder: value.subfolder,
          title: value.title,
          description: value.description,
          source: { ...value.source },
          chart: { ...value.chart },
          styles: { ...value.styles },
        }
      : {
          ...blankModule,
          source: { ...blankModule.source },
          chart: { ...blankModule.chart },
          styles: { ...blankModule.styles },
        };
    setModuleDraft(draft);
    setModuleRevision(value?.revision ?? null);
    setInputJson(JSON.stringify(draft.source.input, null, 2));
    setSqlText(
      typeof draft.source.input.sql === "string" ? draft.source.input.sql : "",
    );
    setError("");
  };
  const submitModule = async () => {
    if (!moduleDraft) return;
    try {
      const parsed: unknown =
        moduleDraft.source.resourceId === "report-query"
          ? moduleDraft.source.sqlFile !== undefined
            ? { maxRows: moduleDraft.source.input.maxRows ?? 100 }
            : { sql: sqlText, maxRows: moduleDraft.source.input.maxRows ?? 100 }
          : JSON.parse(inputJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("Resource input must be a JSON object");
      setBusy(true);
      await saveModule(
        {
          ...moduleDraft,
          source: {
            ...moduleDraft.source,
            input: parsed as Record<string, unknown>,
          },
        },
        moduleRevision,
      );
      setModuleDraft(null);
      await refresh();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };
  const submitDashboard = async () => {
    if (!dashboardDraft) return;
    try {
      setBusy(true);
      const saved = await saveDashboard(dashboardDraft, dashboardRevision);
      setDashboardDraft(null);
      await refresh();
      setSelected(saved.name);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };
  const updateModule = (change: Partial<ModuleDefinition>) =>
    setModuleDraft((current) =>
      current ? { ...current, ...change } : current,
    );
  const updateDashboard = (change: Partial<DashboardDefinition>) =>
    setDashboardDraft((current) =>
      current ? { ...current, ...change } : current,
    );

  return (
    <div className="analytics-page">
      <div className="analytics-breadcrumb">
        Analytics <Icon name="chevron" size={13} /> Dashboards
      </div>
      <div className="analytics-heading">
        <div>
          <span className="analytics-eyebrow">REPORTING WORKSPACE</span>
          <h1>{dashboard?.title ?? "Dashboards"}</h1>
          <p>
            {dashboard?.description ||
              "Build reports from reusable modules connected to your data stack."}
          </p>
        </div>
        <div className="analytics-toolbar">
          <select
            aria-label="Choose dashboard"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Choose dashboard</option>
            {dashboards.map((item) => (
              <option key={item.name} value={item.name}>
                {item.title}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => openModule()}>
            + New module
          </button>
          <button type="button" onClick={() => openDashboard()}>
            + New dashboard
          </button>
          {dashboard && (
            <button
              type="button"
              className="analytics-primary"
              onClick={() => openDashboard(dashboard)}
            >
              <Icon name="gear" size={15} /> Edit dashboard
            </button>
          )}
        </div>
      </div>
      {error && (
        <div role="alert" className="analytics-error analytics-page-error">
          {error}
        </div>
      )}
      {loading ? (
        <div className="analytics-empty">Loading dashboards…</div>
      ) : !dashboard ? (
        <div className="analytics-empty">
          <Icon name="chart" size={32} />
          <h2>Your reports start here</h2>
          <p>
            Create a module from a service resource, then add it to a dashboard.
          </p>
          <div>
            <button type="button" onClick={() => openModule()}>
              Create module
            </button>
            <button
              type="button"
              className="analytics-primary"
              onClick={() => openDashboard()}
            >
              Create dashboard
            </button>
          </div>
        </div>
      ) : (
        <div
          className="analytics-grid"
          style={{
            gridTemplateColumns:
              dashboard.styles.columns === 1 ? "minmax(0, 1fr)" : undefined,
            gap: { compact: 10, regular: 16, relaxed: 24 }[
              dashboard.styles.spacing
            ],
          }}
        >
          {dashboard.modules.map((item) => {
            const module = modules.find(
              (candidate) => keyOf(candidate) === keyOf(item),
            );
            return (
              <div
                key={keyOf(item)}
                className={item.width === "full" ? "analytics-span-full" : ""}
              >
                {module ? (
                  <ModuleCard
                    module={module}
                    onEdit={() => openModule(module)}
                  />
                ) : (
                  <div className="analytics-card analytics-missing">
                    Missing module: {keyOf(item)}
                  </div>
                )}
              </div>
            );
          })}
          {!dashboard.modules.length && (
            <div className="analytics-empty analytics-span-full">
              <h2>This dashboard is empty</h2>
              <p>Add modules to build the report.</p>
              <button type="button" onClick={() => openDashboard(dashboard)}>
                Add modules
              </button>
            </div>
          )}
        </div>
      )}

      {(dashboardDraft || moduleDraft) && (
        <div className="analytics-overlay">
          <aside
            className="analytics-editor"
            aria-label={moduleDraft ? "Module editor" : "Dashboard editor"}
          >
            <header>
              <div>
                <span className="analytics-eyebrow">ANALYTICS BUILDER</span>
                <h2>
                  {moduleDraft
                    ? moduleRevision
                      ? "Edit module"
                      : "New module"
                    : dashboardRevision
                      ? "Edit dashboard"
                      : "New dashboard"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close editor"
                onClick={() => {
                  setDashboardDraft(null);
                  setModuleDraft(null);
                  setError("");
                }}
              >
                <Icon name="close" />
              </button>
            </header>
            {error && (
              <div role="alert" className="analytics-error">
                {error}
              </div>
            )}
            {moduleDraft ? (
              <div className="analytics-form">
                <label>
                  Module name
                  <input
                    value={moduleDraft.name}
                    disabled={moduleRevision !== null}
                    onChange={(event) =>
                      updateModule({ name: slug(event.target.value) })
                    }
                    placeholder="monthly-revenue"
                  />
                </label>
                <label>
                  Subfolder (optional)
                  <input
                    value={moduleDraft.subfolder ?? ""}
                    disabled={moduleRevision !== null}
                    onChange={(event) =>
                      updateModule({
                        subfolder: event.target.value || undefined,
                      })
                    }
                    placeholder="finance"
                  />
                </label>
                <label>
                  Headline
                  <input
                    value={moduleDraft.title}
                    onChange={(event) =>
                      updateModule({ title: event.target.value })
                    }
                    placeholder="Monthly revenue"
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={moduleDraft.description}
                    onChange={(event) =>
                      updateModule({ description: event.target.value })
                    }
                    rows={2}
                  />
                </label>
                <div className="analytics-form-divider">DATA SOURCE</div>
                <label>
                  Service
                  <select
                    value={moduleDraft.source.serviceId}
                    onChange={(event) =>
                      updateModule({
                        source: {
                          ...moduleDraft.source,
                          serviceId: event.target.value,
                          resourceId: "",
                        },
                      })
                    }
                  >
                    <option value="">Choose service</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Resource query
                  <select
                    value={moduleDraft.source.resourceId}
                    onChange={(event) =>
                      updateModule({
                        source: {
                          ...moduleDraft.source,
                          resourceId: event.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Choose resource</option>
                    {resources.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.id}
                      </option>
                    ))}
                  </select>
                </label>
                {moduleDraft.source.resourceId === "report-query" ? (
                  <>
                    <label>
                      SQL source
                      <select
                        value={
                          moduleDraft.source.sqlFile !== undefined
                            ? "file"
                            : "inline"
                        }
                        onChange={(event) =>
                          updateModule({
                            source: {
                              ...moduleDraft.source,
                              sqlFile:
                                event.target.value === "file" ? "" : undefined,
                            },
                          })
                        }
                      >
                        <option value="inline">Write SQL here</option>
                        <option value="file">Use a .sql file</option>
                      </select>
                    </label>
                    {moduleDraft.source.sqlFile !== undefined ? (
                      <label>
                        SQL file in analytics/queries
                        <input
                          value={moduleDraft.source.sqlFile}
                          onChange={(event) =>
                            updateModule({
                              source: {
                                ...moduleDraft.source,
                                sqlFile: event.target.value,
                              },
                            })
                          }
                          placeholder="spotify/daily-plays.sql"
                        />
                      </label>
                    ) : (
                      <label>
                        Read-only SQL query
                        <textarea
                          className="analytics-code"
                          rows={7}
                          value={sqlText}
                          onChange={(event) => setSqlText(event.target.value)}
                          placeholder="SELECT month, revenue FROM reporting.monthly_revenue"
                        />
                      </label>
                    )}
                  </>
                ) : (
                  <label>
                    Resource input (JSON)
                    <textarea
                      className="analytics-code"
                      rows={4}
                      value={inputJson}
                      onChange={(event) => setInputJson(event.target.value)}
                    />
                  </label>
                )}
                <label>
                  Rows path (optional)
                  <input
                    value={moduleDraft.source.rowsPath}
                    onChange={(event) =>
                      updateModule({
                        source: {
                          ...moduleDraft.source,
                          rowsPath: event.target.value,
                        },
                      })
                    }
                    placeholder="rows or data.items"
                  />
                </label>
                <div className="analytics-form-divider">VISUALIZATION</div>
                <label>
                  Chart type
                  <select
                    value={moduleDraft.chart.type}
                    onChange={(event) =>
                      updateModule({
                        chart: {
                          ...moduleDraft.chart,
                          type: event.target
                            .value as ModuleDefinition["chart"]["type"],
                        },
                      })
                    }
                  >
                    <option value="metric">Metric</option>
                    <option value="line">Line chart</option>
                    <option value="bar">Bar chart</option>
                    <option value="table">Table</option>
                  </select>
                </label>
                <div className="analytics-form-row">
                  <label>
                    X field
                    <input
                      value={moduleDraft.chart.x}
                      onChange={(event) =>
                        updateModule({
                          chart: {
                            ...moduleDraft.chart,
                            x: event.target.value,
                          },
                        })
                      }
                      placeholder="month"
                    />
                  </label>
                  <label>
                    Y field
                    <input
                      value={moduleDraft.chart.y}
                      onChange={(event) =>
                        updateModule({
                          chart: {
                            ...moduleDraft.chart,
                            y: event.target.value,
                          },
                        })
                      }
                      placeholder="revenue"
                    />
                  </label>
                </div>
                <label>
                  Unit / suffix
                  <input
                    value={moduleDraft.chart.unit}
                    onChange={(event) =>
                      updateModule({
                        chart: {
                          ...moduleDraft.chart,
                          unit: event.target.value,
                        },
                      })
                    }
                    placeholder="USD"
                  />
                </label>
                <div className="analytics-form-divider">STYLES</div>
                <div className="analytics-form-row">
                  <label>
                    Accent color
                    <input
                      type="color"
                      value={moduleDraft.styles.accentColor}
                      onChange={(event) =>
                        updateModule({
                          styles: {
                            ...moduleDraft.styles,
                            accentColor: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Card height
                    <select
                      value={moduleDraft.styles.height}
                      onChange={(event) =>
                        updateModule({
                          styles: {
                            ...moduleDraft.styles,
                            height: event.target
                              .value as ModuleDefinition["styles"]["height"],
                          },
                        })
                      }
                    >
                      <option value="compact">Compact</option>
                      <option value="regular">Regular</option>
                      <option value="tall">Tall</option>
                    </select>
                  </label>
                </div>
                <label className="analytics-check-label">
                  <input
                    type="checkbox"
                    checked={moduleDraft.styles.showGrid}
                    onChange={(event) =>
                      updateModule({
                        styles: {
                          ...moduleDraft.styles,
                          showGrid: event.target.checked,
                        },
                      })
                    }
                  />
                  Show chart grid
                </label>
              </div>
            ) : (
              dashboardDraft && (
                <div className="analytics-form">
                  <label>
                    Dashboard name
                    <input
                      value={dashboardDraft.name}
                      disabled={dashboardRevision !== null}
                      onChange={(event) =>
                        updateDashboard({ name: slug(event.target.value) })
                      }
                      placeholder="executive-overview"
                    />
                  </label>
                  <label>
                    Headline
                    <input
                      value={dashboardDraft.title}
                      onChange={(event) =>
                        updateDashboard({ title: event.target.value })
                      }
                      placeholder="Executive overview"
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      rows={3}
                      value={dashboardDraft.description}
                      onChange={(event) =>
                        updateDashboard({ description: event.target.value })
                      }
                    />
                  </label>
                  <div className="analytics-form-divider">STYLES</div>
                  <div className="analytics-form-row">
                    <label>
                      Columns
                      <select
                        value={dashboardDraft.styles.columns}
                        onChange={(event) =>
                          updateDashboard({
                            styles: {
                              ...dashboardDraft.styles,
                              columns: event.target.value === "1" ? 1 : 2,
                            },
                          })
                        }
                      >
                        <option value="1">One</option>
                        <option value="2">Two</option>
                      </select>
                    </label>
                    <label>
                      Spacing
                      <select
                        value={dashboardDraft.styles.spacing}
                        onChange={(event) =>
                          updateDashboard({
                            styles: {
                              ...dashboardDraft.styles,
                              spacing: event.target
                                .value as DashboardDefinition["styles"]["spacing"],
                            },
                          })
                        }
                      >
                        <option value="compact">Compact</option>
                        <option value="regular">Regular</option>
                        <option value="relaxed">Relaxed</option>
                      </select>
                    </label>
                  </div>
                  <div className="analytics-form-divider">MODULES</div>
                  {!modules.length && (
                    <p className="analytics-hint">
                      Create a module first, then add it here.
                    </p>
                  )}
                  {modules.map((module) => {
                    const index = dashboardDraft.modules.findIndex(
                      (item) => keyOf(item) === keyOf(module),
                    );
                    const added = index >= 0;
                    return (
                      <div
                        className="analytics-library-item"
                        key={keyOf(module)}
                      >
                        <div>
                          <strong>{module.title}</strong>
                          <small>
                            {module.subfolder ? `${module.subfolder}/` : ""}
                            {module.name} · {module.chart.type}
                          </small>
                        </div>
                        {added && (
                          <select
                            aria-label={`Width of ${module.title}`}
                            value={dashboardDraft.modules[index]?.width}
                            onChange={(event) =>
                              updateDashboard({
                                modules: dashboardDraft.modules.map(
                                  (item, at) =>
                                    at === index
                                      ? {
                                          ...item,
                                          width: event.target.value as
                                            | "half"
                                            | "full",
                                        }
                                      : item,
                                ),
                              })
                            }
                          >
                            <option value="half">Half</option>
                            <option value="full">Full</option>
                          </select>
                        )}
                        <button
                          type="button"
                          aria-label={
                            added
                              ? `Remove ${module.title}`
                              : `Add ${module.title}`
                          }
                          onClick={() =>
                            updateDashboard({
                              modules: added
                                ? dashboardDraft.modules.filter(
                                    (_, at) => at !== index,
                                  )
                                : [
                                    ...dashboardDraft.modules,
                                    {
                                      module: module.name,
                                      subfolder: module.subfolder,
                                      width: "half",
                                    },
                                  ],
                            })
                          }
                        >
                          {added ? "Remove" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )}
            <footer>
              <button
                type="button"
                onClick={() => {
                  setDashboardDraft(null);
                  setModuleDraft(null);
                  setError("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="analytics-primary"
                disabled={busy}
                onClick={() =>
                  void (moduleDraft ? submitModule() : submitDashboard())
                }
              >
                {busy
                  ? "Saving…"
                  : moduleDraft
                    ? "Save module"
                    : "Save dashboard"}
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
