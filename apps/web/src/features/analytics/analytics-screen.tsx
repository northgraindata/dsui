import { useCallback, useEffect, useState } from "react";
import { executeResource, getServices, type Service } from "../../api";
import { Icon } from "../../components/icon";
import {
  type DashboardDefinition,
  type DashboardItem,
  type DashboardModule,
  type DashboardView,
  listDashboards,
  listModules,
  listResources,
  type ModuleDefinition,
  type ResourceOption,
  type Saved,
  saveDashboard,
  saveModule,
  setDashboardFavorite,
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
  tags: [],
  styles: { columns: 2, spacing: "regular" },
  modules: [],
  views: [{ name: "overview", title: "Overview", modules: [] }],
};

function dashboardViews(dashboard: DashboardDefinition): DashboardView[] {
  return dashboard.views.length
    ? dashboard.views
    : [{ name: "overview", title: "Overview", modules: dashboard.modules }];
}

function layoutDefinition(dashboard: DashboardDefinition): DashboardDefinition {
  return {
    name: dashboard.name,
    title: dashboard.title,
    description: dashboard.description,
    tags: [...dashboard.tags],
    ownerId: dashboard.ownerId,
    visibility: dashboard.visibility,
    styles: { ...dashboard.styles },
    modules: [],
    views: dashboardViews(dashboard).map((view) => ({
      name: view.name,
      title: view.title,
      modules: view.modules.map((item) => ({ ...item })),
    })),
  };
}

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
function nextView(views: DashboardView[]) {
  const names = new Set(views.map((view) => view.name));
  let number = views.length + 1;
  while (names.has(`view-${number}`)) number += 1;
  return { name: `view-${number}`, title: `View ${number}`, modules: [] };
}
function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}
const galleryTabs = ["all", "favorites"] as const;

function ModuleCard({ module }: { module: Saved<ModuleDefinition> }) {
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

export function AnalyticsScreen({
  section = "dashboards",
}: {
  section?: "dashboards" | "modules";
}) {
  const [modules, setModules] = useState<Array<Saved<ModuleDefinition>>>([]);
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [favoriteBusy, setFavoriteBusy] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [layoutDraft, setLayoutDraft] = useState<DashboardDefinition | null>(
    null,
  );
  const [draggedModule, setDraggedModule] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedView, setSelectedView] = useState("overview");
  const [draftView, setDraftView] = useState("overview");
  const [search, setSearch] = useState("");
  const [tagsInput, setTagsInput] = useState("");
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
        nextDashboards.some((item) => item.name === current) ? current : "",
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
  const displayDashboard = layoutDraft ?? dashboard;
  const views = displayDashboard ? dashboardViews(displayDashboard) : [];
  const activeView =
    views.find((view) => view.name === selectedView) ?? views[0];
  const draftActiveView = dashboardDraft?.views.find(
    (view) => view.name === draftView,
  );
  const visibleDashboards = dashboards.filter((item) => {
    const matchesSearch =
      `${item.title} ${item.description} ${item.tags.join(" ")}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "favorites") return item.favorite;
    return true;
  });
  const openDashboard = (value?: Saved<DashboardDefinition>) => {
    setDashboardDraft(
      value
        ? {
            name: value.name,
            title: value.title,
            description: value.description,
            tags: [...value.tags],
            ownerId: value.ownerId,
            visibility: value.visibility,
            styles: { ...value.styles },
            modules: [],
            views: dashboardViews(value).map((view) => ({
              ...view,
              modules: view.modules.map((item) => ({ ...item })),
            })),
          }
        : {
            ...blankDashboard,
            modules: [],
            views: [{ name: "overview", title: "Overview", modules: [] }],
          },
    );
    setTagsInput(value?.tags.join(", ") ?? "");
    setDraftView(
      value && dashboardViews(value).some((view) => view.name === selectedView)
        ? selectedView
        : (dashboardViews(value ?? blankDashboard)[0]?.name ?? "overview"),
    );
    setDashboardRevision(value?.revision ?? null);
    setModuleDraft(null);
    setEditorOpen(true);
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
    setEditorOpen(true);
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
      setEditorOpen(false);
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
      const isNew = dashboardRevision === null;
      const saved = await saveDashboard(
        {
          ...dashboardDraft,
          tags: tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
        dashboardRevision,
      );
      setDashboardDraft(null);
      setEditorOpen(false);
      setEditMode(isNew);
      setLayoutDraft(isNew ? layoutDefinition(saved) : null);
      await refresh();
      setSelected(saved.name);
      setSelectedView(
        saved.views.some((view) => view.name === draftView)
          ? draftView
          : (saved.views[0]?.name ?? "overview"),
      );
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
  const toggleFavorite = async (item: DashboardItem) => {
    try {
      setFavoriteBusy(item.name);
      const result = await setDashboardFavorite(item.name, !item.favorite);
      setDashboards((current) =>
        current.map((dashboard) =>
          dashboard.name === item.name
            ? { ...dashboard, favorite: result.favorite }
            : dashboard,
        ),
      );
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setFavoriteBusy(null);
    }
  };
  const updateLayoutModules = (
    change: (items: DashboardModule[]) => DashboardModule[],
  ) =>
    setLayoutDraft((current) =>
      current
        ? {
            ...current,
            views: current.views.map((view) =>
              view.name === selectedView
                ? { ...view, modules: change(view.modules) }
                : view,
            ),
          }
        : current,
    );
  const moveModule = (source: string, target: string) => {
    updateLayoutModules((items) => {
      const from = items.findIndex((item) => keyOf(item) === source);
      const to = items.findIndex((item) => keyOf(item) === target);
      if (from < 0 || to < 0 || from === to) return items;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      if (!moved) return items;
      next.splice(to, 0, moved);
      return next;
    });
  };
  const saveLayout = async () => {
    if (!layoutDraft || !dashboard) return;
    try {
      setBusy(true);
      await saveDashboard(layoutDefinition(layoutDraft), dashboard.revision);
      setLayoutDraft(null);
      setEditMode(false);
      await refresh();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="analytics-page">
      <div className="analytics-breadcrumb">
        Analytics <Icon name="chevron" size={13} />{" "}
        {section === "modules" ? "Modules" : "Dashboards"}
      </div>
      <div className="analytics-heading">
        <div>
          {dashboard && section === "dashboards" && (
            <button
              type="button"
              className="analytics-back"
              onClick={() => {
                setSelected("");
                setEditMode(false);
                setLayoutDraft(null);
              }}
            >
              ← All dashboards
            </button>
          )}
          <h1>
            {section === "modules"
              ? "Modules"
              : (dashboard?.title ?? "Dashboards")}
          </h1>
          <p>
            {section === "modules"
              ? "Reusable charts and metrics for your dashboards."
              : dashboard?.description ||
                "Organize, view and manage dashboards across your data stack."}
          </p>
        </div>
        <div className="analytics-toolbar">
          {!dashboard && section === "dashboards" && (
            <label className="analytics-dashboard-search">
              <Icon name="search" size={16} />
              <input
                aria-label="Search dashboards"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search dashboards…"
              />
            </label>
          )}
          {section === "modules" && (
            <>
              <button
                type="button"
                onClick={() => setEditMode((value) => !value)}
                aria-pressed={editMode}
              >
                <Icon name="gear" size={15} /> {editMode ? "Done" : "Edit"}
              </button>
              <button
                type="button"
                className="analytics-primary"
                onClick={() => openModule()}
              >
                <Icon name="plus" size={15} /> New module
              </button>
            </>
          )}
          {!dashboard && section === "dashboards" && (
            <button
              type="button"
              className="analytics-primary"
              onClick={() => openDashboard()}
            >
              <Icon name="plus" size={15} /> New dashboard
            </button>
          )}
          {dashboard &&
            section === "dashboards" &&
            (editMode ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    openDashboard({
                      ...(layoutDraft ?? dashboard),
                      revision: dashboard.revision,
                    })
                  }
                >
                  <Icon name="gear" size={15} /> Dashboard settings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(false);
                    setLayoutDraft(null);
                    setDraggedModule(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="analytics-primary"
                  disabled={busy}
                  onClick={() => void saveLayout()}
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="analytics-primary"
                onClick={() => {
                  setLayoutDraft(layoutDefinition(dashboard));
                  setEditMode(true);
                }}
              >
                <Icon name="gear" size={15} /> Edit
              </button>
            ))}
        </div>
      </div>
      {!dashboard && section === "dashboards" && (
        <div
          className="analytics-gallery-tabs"
          role="tablist"
          aria-label="Filter dashboards"
        >
          {galleryTabs.map((tab) => (
            <button
              type="button"
              key={tab}
              role="tab"
              id={`analytics-gallery-tab-${tab}`}
              aria-controls="analytics-dashboard-gallery"
              aria-selected={filter === tab}
              tabIndex={filter === tab ? 0 : -1}
              onClick={() => setFilter(tab)}
              onKeyDown={(event) => {
                const current = galleryTabs.indexOf(tab);
                let next = current;
                if (event.key === "ArrowRight")
                  next = (current + 1) % galleryTabs.length;
                else if (event.key === "ArrowLeft")
                  next =
                    (current - 1 + galleryTabs.length) % galleryTabs.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = galleryTabs.length - 1;
                else return;
                event.preventDefault();
                const target = galleryTabs[next];
                if (!target) return;
                setFilter(target);
                document
                  .getElementById(`analytics-gallery-tab-${target}`)
                  ?.focus();
              }}
            >
              {tab[0]?.toUpperCase()}
              {tab.slice(1)}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div role="alert" className="analytics-error analytics-page-error">
          {error}
        </div>
      )}
      {loading ? (
        <div className="analytics-empty">Loading analytics…</div>
      ) : section === "modules" ? (
        <div className="analytics-modules-gallery">
          {modules.map((module) => (
            <div className="analytics-module-preview" key={keyOf(module)}>
              <ModuleCard module={module} />
              {editMode && (
                <button
                  type="button"
                  className="analytics-module-edit"
                  onClick={() => openModule(module)}
                >
                  <Icon name="gear" size={15} /> Edit module
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="analytics-dashboard-tile analytics-dashboard-tile--new"
            onClick={() => openModule()}
          >
            <span className="analytics-dashboard-icon">
              <Icon name="plus" size={25} />
            </span>
            <strong>Create new module</strong>
            <span>
              Define a reusable chart or metric from a service resource.
            </span>
          </button>
          {!modules.length && (
            <p className="analytics-gallery-hint">
              Create a module here, then place it on a dashboard.
            </p>
          )}
        </div>
      ) : !dashboard ? (
        <div
          className="analytics-dashboard-gallery"
          id="analytics-dashboard-gallery"
          role="tabpanel"
          aria-labelledby={`analytics-gallery-tab-${filter}`}
        >
          {visibleDashboards.map((item) => (
            <article key={item.name} className="analytics-dashboard-tile">
              <button
                type="button"
                className="analytics-dashboard-open"
                onClick={() => {
                  setSelected(item.name);
                  setSelectedView(dashboardViews(item)[0]?.name ?? "overview");
                }}
              >
                <span className="analytics-dashboard-icon">
                  <Icon
                    name={
                      ["database", "chart", "table", "activity"][
                        dashboards.indexOf(item) % 4
                      ] ?? "grid"
                    }
                    size={23}
                  />
                </span>
                <strong>{item.title}</strong>
                <span className="analytics-dashboard-description">
                  {item.description ||
                    "Open this dashboard to explore its modules."}
                </span>
                <span className="analytics-dashboard-tags">
                  {item.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </span>
                <span className="analytics-dashboard-meta">
                  {dashboardViews(item).length}{" "}
                  {dashboardViews(item).length === 1 ? "view" : "views"}
                  <span>·</span>
                  {dashboardViews(item).reduce(
                    (count, view) => count + view.modules.length,
                    0,
                  )}{" "}
                  modules
                </span>
              </button>
              <button
                type="button"
                className="analytics-dashboard-favorite"
                aria-label={`${item.favorite ? "Remove" : "Add"} ${item.title} ${item.favorite ? "from" : "to"} favorites`}
                aria-pressed={item.favorite}
                disabled={favoriteBusy === item.name}
                onClick={() => void toggleFavorite(item)}
              >
                <Icon name="star" size={18} />
              </button>
            </article>
          ))}
          {!search.trim() && filter === "all" && (
            <button
              type="button"
              className="analytics-dashboard-tile analytics-dashboard-tile--new"
              onClick={() => openDashboard()}
            >
              <span className="analytics-dashboard-icon">
                <Icon name="plus" size={25} />
              </span>
              <strong>Create new dashboard</strong>
              <span>Build a dashboard from reusable modules.</span>
            </button>
          )}
          {!visibleDashboards.length &&
            (search.trim() || filter === "favorites") && (
              <div className="analytics-empty">
                {search.trim()
                  ? "No dashboards match your search."
                  : "Star a dashboard to find it here."}
              </div>
            )}
          {!dashboards.length && filter === "all" && (
            <p className="analytics-gallery-hint">
              Create a module from a service resource, then add it to a
              dashboard.
            </p>
          )}
        </div>
      ) : (
        <div>
          <div
            className="analytics-view-tabs"
            role="tablist"
            aria-label="Dashboard views"
          >
            {views.map((view) => (
              <button
                type="button"
                key={view.name}
                role="tab"
                id={`analytics-view-${view.name}`}
                aria-controls="analytics-view-panel"
                aria-selected={view.name === activeView?.name}
                tabIndex={view.name === activeView?.name ? 0 : -1}
                onClick={() => setSelectedView(view.name)}
                onKeyDown={(event) => {
                  const current = views.findIndex(
                    (item) => item.name === view.name,
                  );
                  let next = current;
                  if (event.key === "ArrowRight")
                    next = (current + 1) % views.length;
                  else if (event.key === "ArrowLeft")
                    next = (current - 1 + views.length) % views.length;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = views.length - 1;
                  else return;
                  event.preventDefault();
                  const name = views[next]?.name;
                  if (!name) return;
                  setSelectedView(name);
                  document.getElementById(`analytics-view-${name}`)?.focus();
                }}
              >
                {view.title}
              </button>
            ))}
          </div>
          <div className={editMode ? "analytics-builder-layout" : undefined}>
            <div
              className="analytics-grid"
              role="tabpanel"
              id="analytics-view-panel"
              aria-labelledby={`analytics-view-${activeView?.name ?? "overview"}`}
              style={{
                gridTemplateColumns:
                  displayDashboard?.styles.columns === 1
                    ? "minmax(0, 1fr)"
                    : undefined,
                gap: { compact: 10, regular: 16, relaxed: 24 }[
                  displayDashboard?.styles.spacing ?? "regular"
                ],
              }}
            >
              {activeView?.modules.map((item) => {
                const module = modules.find(
                  (candidate) => keyOf(candidate) === keyOf(item),
                );
                return (
                  <fieldset
                    key={keyOf(item)}
                    aria-label={`${module?.title ?? item.module} tile`}
                    className={`analytics-tile ${item.width === "full" ? "analytics-span-full" : ""} ${editMode ? "analytics-layout-tile" : ""} ${dropTarget === keyOf(item) ? "analytics-layout-tile--target" : ""}`}
                    draggable={editMode}
                    onDragStart={(event) => {
                      if (!editMode) return;
                      setDraggedModule(keyOf(item));
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", keyOf(item));
                    }}
                    onDragOver={(event) => {
                      if (
                        editMode &&
                        draggedModule &&
                        draggedModule !== keyOf(item)
                      ) {
                        event.preventDefault();
                        setDropTarget(keyOf(item));
                      }
                    }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggedModule) moveModule(draggedModule, keyOf(item));
                      setDraggedModule(null);
                      setDropTarget(null);
                    }}
                    onDragEnd={() => {
                      setDraggedModule(null);
                      setDropTarget(null);
                    }}
                  >
                    {editMode && (
                      <div className="analytics-tile-controls">
                        <span aria-hidden="true">⠿ Drag to move</span>
                        <button
                          type="button"
                          aria-label={`Move ${module?.title ?? item.module} left`}
                          disabled={activeView?.modules[0] === item}
                          onClick={() => {
                            const index =
                              activeView?.modules.findIndex(
                                (candidate) => keyOf(candidate) === keyOf(item),
                              ) ?? -1;
                            const previous = activeView?.modules[index - 1];
                            if (previous)
                              moveModule(keyOf(item), keyOf(previous));
                          }}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${module?.title ?? item.module} right`}
                          disabled={activeView?.modules.at(-1) === item}
                          onClick={() => {
                            const index =
                              activeView?.modules.findIndex(
                                (candidate) => keyOf(candidate) === keyOf(item),
                              ) ?? -1;
                            const next = activeView?.modules[index + 1];
                            if (next) moveModule(keyOf(item), keyOf(next));
                          }}
                        >
                          →
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateLayoutModules((items) =>
                              items.map((candidate) =>
                                keyOf(candidate) === keyOf(item)
                                  ? {
                                      ...candidate,
                                      width:
                                        candidate.width === "full"
                                          ? "half"
                                          : "full",
                                    }
                                  : candidate,
                              ),
                            )
                          }
                        >
                          {item.width === "full" ? "Half width" : "Full width"}
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${module?.title ?? item.module}`}
                          onClick={() =>
                            updateLayoutModules((items) =>
                              items.filter(
                                (candidate) => keyOf(candidate) !== keyOf(item),
                              ),
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {module ? (
                      <ModuleCard module={module} />
                    ) : (
                      <div className="analytics-card analytics-missing">
                        Missing module: {keyOf(item)}
                      </div>
                    )}
                  </fieldset>
                );
              })}
              {!activeView?.modules.length && (
                <div className="analytics-empty analytics-span-full">
                  <h2>This view is empty</h2>
                  <p>Add modules to build the report.</p>
                  {!editMode && <p>Choose Edit to place modules.</p>}
                </div>
              )}
            </div>
            {editMode && (
              <aside
                className="analytics-module-library"
                aria-label="Module library"
              >
                <h2>Modules</h2>
                <p>Add reusable tiles to {activeView?.title ?? "this view"}.</p>
                {modules.map((module) => {
                  const added = activeView?.modules.some(
                    (item) => keyOf(item) === keyOf(module),
                  );
                  return (
                    <button
                      type="button"
                      key={keyOf(module)}
                      disabled={
                        added || (activeView?.modules.length ?? 0) >= 40
                      }
                      onClick={() =>
                        updateLayoutModules((items) => [
                          ...items,
                          {
                            module: module.name,
                            subfolder: module.subfolder,
                            width: "half",
                          },
                        ])
                      }
                    >
                      <Icon name="chart" size={18} />
                      <span>
                        <strong>{module.title}</strong>
                        <small>
                          {module.chart.type} ·{" "}
                          {module.subfolder ? `${module.subfolder}/` : ""}
                          {module.name}
                        </small>
                      </span>
                      <span>{added ? "Added" : "+"}</span>
                    </button>
                  );
                })}
                <button type="button" onClick={() => openModule()}>
                  <Icon name="plus" size={18} /> New module
                </button>
              </aside>
            )}
          </div>
        </div>
      )}

      {editorOpen && (dashboardDraft || moduleDraft) && (
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
                  setEditorOpen(false);
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
                {moduleDraft.chart.type === "line" && (
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
                )}
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
                  <label>
                    Tags
                    <input
                      value={tagsInput}
                      onChange={(event) => setTagsInput(event.target.value)}
                      placeholder="Finance, Operations, Revenue"
                    />
                    <small>Separate tags with commas (up to 8).</small>
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
                  <div className="analytics-form-divider">VIEWS</div>
                  <div className="analytics-draft-views">
                    {dashboardDraft.views.map((view) => (
                      <button
                        type="button"
                        key={view.name}
                        aria-pressed={draftView === view.name}
                        onClick={() => setDraftView(view.name)}
                      >
                        {view.title}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={dashboardDraft.views.length >= 12}
                      onClick={() => {
                        const view = nextView(dashboardDraft.views);
                        updateDashboard({
                          views: [...dashboardDraft.views, view],
                        });
                        setDraftView(view.name);
                      }}
                    >
                      + Add view
                    </button>
                  </div>
                  {draftActiveView && (
                    <div className="analytics-view-editor">
                      <label>
                        View title
                        <input
                          value={draftActiveView.title}
                          onChange={(event) =>
                            updateDashboard({
                              views: dashboardDraft.views.map((view) =>
                                view.name === draftView
                                  ? { ...view, title: event.target.value }
                                  : view,
                              ),
                            })
                          }
                        />
                      </label>
                      {dashboardDraft.views.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const remaining = dashboardDraft.views.filter(
                              (view) => view.name !== draftView,
                            );
                            updateDashboard({ views: remaining });
                            setDraftView(remaining[0]?.name ?? "overview");
                          }}
                        >
                          Remove view
                        </button>
                      )}
                    </div>
                  )}
                  <p className="analytics-hint">
                    Add and arrange modules on the dashboard canvas after
                    saving.
                  </p>
                </div>
              )
            )}
            <footer>
              <button
                type="button"
                onClick={() => {
                  setDashboardDraft(null);
                  setModuleDraft(null);
                  setEditorOpen(false);
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

export function ModulesScreen() {
  return <AnalyticsScreen section="modules" />;
}
