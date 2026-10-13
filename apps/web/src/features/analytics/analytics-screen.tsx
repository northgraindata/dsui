import { DatePicker, OptionSelect } from "@northgraindata/dsui-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { executeResource, getServices, type Service } from "../../api";
import { Icon } from "../../components/icon";
import {
  type DashboardDefinition,
  type DashboardFilter,
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
  filters: [],
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
    filters: dashboard.filters.map((filter) => ({ ...filter })),
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
function detailValue(value: unknown): string | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  )
    return String(value);
  return null;
}
const galleryTabs = ["all", "favorites"] as const;
const emptyFilterValues: Record<string, string> = {};

function defaultFilterValues(
  filters: DashboardFilter[],
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const filter of filters) {
    if (filter.type === "date-range") {
      values[`${filter.name}.start`] = filter.defaultStart ?? "";
      values[`${filter.name}.end`] = filter.defaultEnd ?? "";
    } else values[filter.name] = filter.defaultValue ?? "";
  }
  return values;
}

function nextFilterName(filters: DashboardFilter[], prefix: string) {
  const names = new Set(filters.map((filter) => filter.name));
  let index = 1;
  while (names.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function ModuleCard({
  module,
  order = 0,
  refreshEpoch = 0,
  onRefreshComplete,
  filterValues = emptyFilterValues,
  parameterOverride,
  onDrilldown,
}: {
  module: Saved<ModuleDefinition>;
  order?: number;
  refreshEpoch?: number;
  onRefreshComplete?: (epoch: number) => void;
  filterValues?: Record<string, string>;
  parameterOverride?: { name: string; value: string };
  onDrilldown?: (value: unknown) => void;
}) {
  const [data, setData] = useState<unknown>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [renderVersion, setRenderVersion] = useState(0);
  const requestId = useRef(0);
  const parameterKey = JSON.stringify(
    module.source.parameters?.length
      ? module.source.parameters.map(
          (name) =>
            (parameterOverride?.name === name
              ? parameterOverride.value
              : filterValues[name]) || null,
        )
      : null,
  );
  const refresh = useCallback(
    async (notifyParent = false) => {
      const currentRequest = ++requestId.current;
      const started = Date.now();
      setLoading(true);
      setError("");
      try {
        const parameters: unknown = JSON.parse(parameterKey);
        const result = await executeResource(
          module.source.serviceId,
          module.source.resourceId,
          parameters !== null
            ? { ...module.source.input, parameters }
            : module.source.input,
        );
        if (requestId.current === currentRequest) {
          setData(result.data);
          setRenderVersion((version) => version + 1);
        }
      } catch (cause) {
        if (requestId.current === currentRequest) setError(errorText(cause));
      } finally {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, Math.max(0, 500 - (Date.now() - started))),
        );
        if (requestId.current === currentRequest) {
          setLoading(false);
          if (notifyParent) onRefreshComplete?.(refreshEpoch);
        }
      }
    },
    [
      module.source.serviceId,
      module.source.resourceId,
      module.source.input,
      parameterKey,
      onRefreshComplete,
      refreshEpoch,
    ],
  );
  useEffect(() => {
    void refresh(true);
    return () => {
      requestId.current += 1;
    };
  }, [refresh]);
  return (
    <article
      className={`analytics-card analytics-card--${module.styles.height}`}
      style={{ animationDelay: `${Math.min(order, 8) * 65}ms` }}
      aria-busy={loading}
    >
      <header>
        <div>
          <h3>{module.title}</h3>
          <p>{module.description}</p>
        </div>
        <div className="analytics-card-actions">
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label={`Refresh ${module.title}`}
            title="Refresh"
            className={loading ? "analytics-refreshing" : undefined}
            disabled={loading}
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </header>
      <div className="analytics-card-visual" key={renderVersion}>
        {loading && data === undefined ? (
          <div className="analytics-empty-visual">Loading data…</div>
        ) : error ? (
          <div className="analytics-error">{error}</div>
        ) : (
          <Visualization
            definition={module}
            data={data}
            onSelect={onDrilldown}
          />
        )}
      </div>
      <footer>
        {module.source.serviceId} · {module.source.resourceId}
        {onDrilldown && <span> · Click a chart value for details</span>}
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
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [drilldown, setDrilldown] = useState<{
    moduleKey: string;
    name: string;
    value: string;
    source: string;
  } | null>(null);
  const drilldownCloseRef = useRef<HTMLButtonElement>(null);
  const drilldownReturnFocus = useRef<HTMLElement>(null);
  const closeDrilldown = useCallback(() => {
    setDrilldown(null);
    requestAnimationFrame(() => drilldownReturnFocus.current?.focus());
  }, []);
  const [dashboardRefresh, setDashboardRefresh] = useState({
    epoch: 0,
    pending: 0,
  });
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
  const [parameterNamesInput, setParameterNamesInput] = useState("");
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
  const drilldownModule = drilldown
    ? modules.find((item) => keyOf(item) === drilldown.moduleKey)
    : undefined;
  const drilldownTargets = modules.filter(
    (item) => item.source.parameters?.length,
  );
  const draftDrilldownKey = moduleDraft?.chart.drilldown
    ? keyOf(moduleDraft.chart.drilldown)
    : undefined;
  const draftDrilldownTarget = draftDrilldownKey
    ? drilldownTargets.find((item) => keyOf(item) === draftDrilldownKey)
    : undefined;
  useEffect(() => {
    setFilterValues(defaultFilterValues(dashboard?.filters ?? []));
    setDrilldown(null);
  }, [dashboard?.filters]);
  useEffect(() => {
    if (!drilldown) return;
    drilldownCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrilldown();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [drilldown, closeDrilldown]);
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
            filters: value.filters.map((filter) => ({ ...filter })),
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
            filters: [],
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
    setParameterNamesInput(draft.source.parameters?.join(", ") ?? "");
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
            parameters: parameterNamesInput
              .split(",")
              .map((name) => name.trim())
              .filter(Boolean),
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
  const refreshDashboard = () => {
    const pending =
      activeView?.modules.filter((item) =>
        modules.some((module) => keyOf(module) === keyOf(item)),
      ).length ?? 0;
    setDashboardRefresh((current) => ({
      epoch: current.epoch + 1,
      pending,
    }));
  };
  const handleModuleRefreshComplete = useCallback((epoch: number) => {
    setDashboardRefresh((current) =>
      current.epoch === epoch && current.pending > 0
        ? { ...current, pending: current.pending - 1 }
        : current,
    );
  }, []);
  const selectView = (name: string) => {
    setSelectedView(name);
    setDrilldown(null);
    setDashboardRefresh((current) =>
      current.pending ? { ...current, pending: 0 } : current,
    );
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
              <>
                <button
                  type="button"
                  onClick={refreshDashboard}
                  disabled={dashboardRefresh.pending > 0}
                  aria-label="Refresh dashboard"
                  className={
                    dashboardRefresh.pending > 0
                      ? "analytics-refreshing"
                      : undefined
                  }
                >
                  <Icon name="refresh" size={15} /> Refresh
                </button>
                <button type="button" onClick={() => window.print()}>
                  Export PDF
                </button>
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
              </>
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
          {modules.map((module, index) => (
            <div className="analytics-module-preview" key={keyOf(module)}>
              <ModuleCard module={module} order={index} />
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
                  setDashboardRefresh((current) =>
                    current.pending ? { ...current, pending: 0 } : current,
                  );
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
                onClick={() => selectView(view.name)}
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
                  selectView(name);
                  document.getElementById(`analytics-view-${name}`)?.focus();
                }}
              >
                {view.title}
              </button>
            ))}
          </div>
          {dashboard.filters.length > 0 && (
            <section
              className="analytics-dashboard-filters"
              aria-label="Dashboard filters"
            >
              {dashboard.filters.map((filter) =>
                filter.type === "date-range" ? (
                  <fieldset key={filter.name}>
                    <legend>{filter.label}</legend>
                    <DatePicker
                      ariaLabel={`${filter.label} from`}
                      value={filterValues[`${filter.name}.start`] ?? ""}
                      max={filterValues[`${filter.name}.end`] || undefined}
                      onValueChange={(value) =>
                        setFilterValues((current) => ({
                          ...current,
                          [`${filter.name}.start`]: value,
                        }))
                      }
                    />
                    <span>to</span>
                    <DatePicker
                      ariaLabel={`${filter.label} to`}
                      value={filterValues[`${filter.name}.end`] ?? ""}
                      min={filterValues[`${filter.name}.start`] || undefined}
                      onValueChange={(value) =>
                        setFilterValues((current) => ({
                          ...current,
                          [`${filter.name}.end`]: value,
                        }))
                      }
                    />
                  </fieldset>
                ) : (
                  <label
                    key={filter.name}
                    htmlFor={`analytics-filter-${filter.name}`}
                  >
                    {filter.label}
                    <OptionSelect
                      id={`analytics-filter-${filter.name}`}
                      ariaLabel={filter.label}
                      value={filterValues[filter.name] ?? ""}
                      onValueChange={(value) =>
                        setFilterValues((current) => ({
                          ...current,
                          [filter.name]: value,
                        }))
                      }
                      options={[
                        { value: "", label: "All" },
                        ...filter.options.map((option) => ({
                          value: option,
                          label: option,
                        })),
                      ]}
                    />
                  </label>
                ),
              )}
              <button
                type="button"
                className="analytics-filter-reset"
                onClick={() =>
                  setFilterValues(defaultFilterValues(dashboard.filters))
                }
              >
                <Icon name="refresh" size={14} />
                Reset filters
              </button>
            </section>
          )}
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
              {activeView?.modules.map((item, index) => {
                const module = modules.find(
                  (candidate) => keyOf(candidate) === keyOf(item),
                );
                return (
                  <fieldset
                    key={`${keyOf(item)}-${dashboardRefresh.epoch}`}
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
                      <ModuleCard
                        module={module}
                        order={index}
                        refreshEpoch={dashboardRefresh.epoch}
                        onRefreshComplete={handleModuleRefreshComplete}
                        filterValues={filterValues}
                        onDrilldown={
                          module.chart.drilldown
                            ? (value) => {
                                const selectedValue = detailValue(value);
                                if (selectedValue === null) return;
                                const target = module.chart.drilldown;
                                if (!target) return;
                                drilldownReturnFocus.current =
                                  document.activeElement instanceof HTMLElement
                                    ? document.activeElement
                                    : null;
                                setDrilldown({
                                  moduleKey: keyOf(target),
                                  name: target.parameter,
                                  value: selectedValue,
                                  source: module.title,
                                });
                              }
                            : undefined
                        }
                      />
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

      {drilldown && (
        <div className="analytics-overlay">
          <button
            type="button"
            className="analytics-overlay-dismiss"
            aria-label="Close details"
            onClick={closeDrilldown}
          />
          <aside
            className="analytics-drilldown-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Details for ${drilldown.value}`}
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const controls =
                event.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)",
                );
              const first = controls[0];
              const last = controls[controls.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
          >
            <header>
              <div>
                <span className="analytics-eyebrow">{drilldown.source}</span>
                <h2>Details: {drilldown.value}</h2>
              </div>
              <button
                type="button"
                ref={drilldownCloseRef}
                aria-label="Close details"
                onClick={closeDrilldown}
              >
                <Icon name="close" />
              </button>
            </header>
            {drilldownModule ? (
              <ModuleCard
                key={`${drilldown.moduleKey}-${drilldown.value}`}
                module={drilldownModule}
                filterValues={filterValues}
                parameterOverride={drilldown}
              />
            ) : (
              <p className="analytics-error">
                The detail module is unavailable.
              </p>
            )}
          </aside>
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
                <label htmlFor="analytics-module-service">
                  Service
                  <OptionSelect
                    id="analytics-module-service"
                    ariaLabel="Service"
                    value={moduleDraft.source.serviceId}
                    onValueChange={(value) =>
                      updateModule({
                        source: {
                          ...moduleDraft.source,
                          serviceId: value,
                          resourceId: "",
                        },
                      })
                    }
                    placeholder="Choose service"
                    options={services.map((service) => ({
                      value: service.id,
                      label: service.name,
                    }))}
                  />
                </label>
                <label htmlFor="analytics-module-resource">
                  Resource query
                  <OptionSelect
                    id="analytics-module-resource"
                    ariaLabel="Resource query"
                    value={moduleDraft.source.resourceId}
                    onValueChange={(value) =>
                      updateModule({
                        source: {
                          ...moduleDraft.source,
                          resourceId: value,
                        },
                      })
                    }
                    placeholder="Choose resource"
                    options={resources.map((resource) => ({
                      value: resource.id,
                      label: resource.id,
                    }))}
                  />
                </label>
                {moduleDraft.source.resourceId === "report-query" ? (
                  <>
                    <label htmlFor="analytics-module-sql-source">
                      SQL source
                      <OptionSelect
                        id="analytics-module-sql-source"
                        ariaLabel="SQL source"
                        value={
                          moduleDraft.source.sqlFile !== undefined
                            ? "file"
                            : "inline"
                        }
                        onValueChange={(value) =>
                          updateModule({
                            source: {
                              ...moduleDraft.source,
                              sqlFile: value === "file" ? "" : undefined,
                            },
                          })
                        }
                        options={[
                          { value: "inline", label: "Write SQL here" },
                          { value: "file", label: "Use a .sql file" },
                        ]}
                      />
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
                    <label>
                      SQL parameter bindings
                      <input
                        value={parameterNamesInput}
                        onChange={(event) =>
                          setParameterNamesInput(event.target.value)
                        }
                        placeholder="period.start, period.end, region"
                      />
                      <small>
                        In $1, $2 order. Use filter names or
                        date-filter.start/end; empty values become NULL.
                      </small>
                    </label>
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
                <label htmlFor="analytics-module-chart-type">
                  Chart type
                  <OptionSelect
                    id="analytics-module-chart-type"
                    ariaLabel="Chart type"
                    value={moduleDraft.chart.type}
                    onValueChange={(value) =>
                      updateModule({
                        chart: {
                          ...moduleDraft.chart,
                          type: value as ModuleDefinition["chart"]["type"],
                          compareTo:
                            value === "kpi"
                              ? moduleDraft.chart.compareTo
                              : undefined,
                          comparisonLabel:
                            value === "kpi"
                              ? moduleDraft.chart.comparisonLabel
                              : undefined,
                        },
                      })
                    }
                    options={[
                      { value: "metric", label: "Metric" },
                      { value: "kpi", label: "KPI comparison" },
                      { value: "line", label: "Line chart" },
                      { value: "area", label: "Area chart" },
                      { value: "bar", label: "Bar chart" },
                      {
                        value: "horizontal-bar",
                        label: "Horizontal bar chart",
                      },
                      { value: "table", label: "Table" },
                    ]}
                  />
                </label>
                <div className="analytics-form-row">
                  {moduleDraft.chart.type !== "kpi" && (
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
                  )}
                  <label>
                    {moduleDraft.chart.type === "kpi"
                      ? "Current value field"
                      : "Y field"}
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
                {(moduleDraft.chart.type === "line" ||
                  moduleDraft.chart.type === "area" ||
                  moduleDraft.chart.type === "bar" ||
                  moduleDraft.chart.type === "horizontal-bar") && (
                  <>
                    <label htmlFor="analytics-module-drilldown">
                      Open details on click
                      <OptionSelect
                        id="analytics-module-drilldown"
                        ariaLabel="Open details on click"
                        value={
                          moduleDraft.chart.drilldown
                            ? keyOf(moduleDraft.chart.drilldown)
                            : ""
                        }
                        onValueChange={(value) => {
                          const target = drilldownTargets.find(
                            (item) => keyOf(item) === value,
                          );
                          updateModule({
                            chart: {
                              ...moduleDraft.chart,
                              drilldown: target
                                ? {
                                    module: target.name,
                                    subfolder: target.subfolder,
                                    parameter:
                                      target.source.parameters?.find(
                                        (name) => name === moduleDraft.chart.x,
                                      ) ??
                                      target.source.parameters?.[0] ??
                                      "",
                                  }
                                : undefined,
                            },
                          });
                        }}
                        options={[
                          { value: "", label: "No detail module" },
                          ...drilldownTargets
                            .filter(
                              (item) => keyOf(item) !== keyOf(moduleDraft),
                            )
                            .map((item) => ({
                              value: keyOf(item),
                              label: item.title,
                            })),
                        ]}
                      />
                    </label>
                    {draftDrilldownTarget && (
                      <label htmlFor="analytics-module-detail-parameter">
                        Detail parameter for clicked X value
                        <OptionSelect
                          id="analytics-module-detail-parameter"
                          ariaLabel="Detail parameter for clicked X value"
                          value={moduleDraft.chart.drilldown?.parameter ?? ""}
                          onValueChange={(value) =>
                            updateModule({
                              chart: {
                                ...moduleDraft.chart,
                                drilldown: moduleDraft.chart.drilldown
                                  ? {
                                      ...moduleDraft.chart.drilldown,
                                      parameter: value,
                                    }
                                  : undefined,
                              },
                            })
                          }
                          options={
                            draftDrilldownTarget.source.parameters?.map(
                              (name) => ({ value: name, label: name }),
                            ) ?? []
                          }
                        />
                      </label>
                    )}
                  </>
                )}
                {moduleDraft.chart.type === "kpi" && (
                  <div className="analytics-form-row">
                    <label>
                      Previous period value field
                      <input
                        value={moduleDraft.chart.compareTo ?? ""}
                        onChange={(event) =>
                          updateModule({
                            chart: {
                              ...moduleDraft.chart,
                              compareTo: event.target.value,
                            },
                          })
                        }
                        placeholder="previous_revenue"
                      />
                    </label>
                    <label>
                      Previous period label
                      <input
                        value={moduleDraft.chart.comparisonLabel ?? ""}
                        onChange={(event) =>
                          updateModule({
                            chart: {
                              ...moduleDraft.chart,
                              comparisonLabel: event.target.value,
                            },
                          })
                        }
                        placeholder="Previous 30 days"
                      />
                    </label>
                  </div>
                )}
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
                  <label htmlFor="analytics-module-card-height">
                    Card height
                    <OptionSelect
                      id="analytics-module-card-height"
                      ariaLabel="Card height"
                      value={moduleDraft.styles.height}
                      onValueChange={(value) =>
                        updateModule({
                          styles: {
                            ...moduleDraft.styles,
                            height:
                              value as ModuleDefinition["styles"]["height"],
                          },
                        })
                      }
                      options={[
                        { value: "compact", label: "Compact" },
                        { value: "regular", label: "Regular" },
                        { value: "tall", label: "Tall" },
                      ]}
                    />
                  </label>
                </div>
                {(moduleDraft.chart.type === "line" ||
                  moduleDraft.chart.type === "area") && (
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
                  <div className="analytics-form-divider">
                    DASHBOARD FILTERS
                  </div>
                  <p className="analytics-hint">
                    Filters are optional and belong to this dashboard. Use names
                    that match the module SQL parameter bindings.
                  </p>
                  {dashboardDraft.filters.map((filter, index) => (
                    <div className="analytics-filter-editor" key={filter.name}>
                      <div className="analytics-form-row">
                        <label>
                          Filter name
                          <input
                            defaultValue={filter.name}
                            onBlur={(event) =>
                              updateDashboard({
                                filters: dashboardDraft.filters.map(
                                  (item, at) =>
                                    at === index
                                      ? {
                                          ...item,
                                          name: slug(event.target.value),
                                        }
                                      : item,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          Label
                          <input
                            value={filter.label}
                            onChange={(event) =>
                              updateDashboard({
                                filters: dashboardDraft.filters.map(
                                  (item, at) =>
                                    at === index
                                      ? { ...item, label: event.target.value }
                                      : item,
                                ),
                              })
                            }
                          />
                        </label>
                      </div>
                      {filter.type === "date-range" ? (
                        <div className="analytics-form-row">
                          <label htmlFor={`analytics-filter-start-${index}`}>
                            Default start
                            <DatePicker
                              id={`analytics-filter-start-${index}`}
                              ariaLabel="Default start"
                              value={filter.defaultStart ?? ""}
                              max={filter.defaultEnd}
                              onValueChange={(value) =>
                                updateDashboard({
                                  filters: dashboardDraft.filters.map(
                                    (item, at) =>
                                      at === index && item.type === "date-range"
                                        ? {
                                            ...item,
                                            defaultStart: value || undefined,
                                          }
                                        : item,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label htmlFor={`analytics-filter-end-${index}`}>
                            Default end
                            <DatePicker
                              id={`analytics-filter-end-${index}`}
                              ariaLabel="Default end"
                              value={filter.defaultEnd ?? ""}
                              min={filter.defaultStart}
                              onValueChange={(value) =>
                                updateDashboard({
                                  filters: dashboardDraft.filters.map(
                                    (item, at) =>
                                      at === index && item.type === "date-range"
                                        ? {
                                            ...item,
                                            defaultEnd: value || undefined,
                                          }
                                        : item,
                                  ),
                                })
                              }
                            />
                          </label>
                        </div>
                      ) : (
                        <>
                          <label>
                            Options (comma separated)
                            <input
                              defaultValue={filter.options.join(", ")}
                              onBlur={(event) =>
                                updateDashboard({
                                  filters: dashboardDraft.filters.map(
                                    (item, at) =>
                                      at === index && item.type === "select"
                                        ? {
                                            ...item,
                                            options: event.target.value
                                              .split(",")
                                              .map((option) => option.trim())
                                              .filter(Boolean),
                                          }
                                        : item,
                                  ),
                                })
                              }
                            />
                          </label>
                          <label htmlFor={`analytics-default-option-${index}`}>
                            Default option
                            <OptionSelect
                              id={`analytics-default-option-${index}`}
                              ariaLabel="Default option"
                              value={filter.defaultValue ?? ""}
                              onValueChange={(value) =>
                                updateDashboard({
                                  filters: dashboardDraft.filters.map(
                                    (item, at) =>
                                      at === index && item.type === "select"
                                        ? {
                                            ...item,
                                            defaultValue: value || undefined,
                                          }
                                        : item,
                                  ),
                                })
                              }
                              options={[
                                { value: "", label: "All" },
                                ...filter.options.map((option) => ({
                                  value: option,
                                  label: option,
                                })),
                              ]}
                            />
                          </label>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          updateDashboard({
                            filters: dashboardDraft.filters.filter(
                              (_, at) => at !== index,
                            ),
                          })
                        }
                      >
                        Remove filter
                      </button>
                    </div>
                  ))}
                  <div className="analytics-form-row">
                    <button
                      type="button"
                      disabled={dashboardDraft.filters.length >= 8}
                      onClick={() =>
                        updateDashboard({
                          filters: [
                            ...dashboardDraft.filters,
                            {
                              name: nextFilterName(
                                dashboardDraft.filters,
                                "period",
                              ),
                              label: "Date range",
                              type: "date-range",
                            },
                          ],
                        })
                      }
                    >
                      + Date range
                    </button>
                    <button
                      type="button"
                      disabled={dashboardDraft.filters.length >= 8}
                      onClick={() =>
                        updateDashboard({
                          filters: [
                            ...dashboardDraft.filters,
                            {
                              name: nextFilterName(
                                dashboardDraft.filters,
                                "selection",
                              ),
                              label: "Selection",
                              type: "select",
                              options: ["Option 1"],
                            },
                          ],
                        })
                      }
                    >
                      + Dropdown filter
                    </button>
                  </div>
                  <div className="analytics-form-divider">STYLES</div>
                  <div className="analytics-form-row">
                    <label htmlFor="analytics-dashboard-columns">
                      Columns
                      <OptionSelect
                        id="analytics-dashboard-columns"
                        ariaLabel="Columns"
                        value={String(dashboardDraft.styles.columns)}
                        onValueChange={(value) =>
                          updateDashboard({
                            styles: {
                              ...dashboardDraft.styles,
                              columns: value === "1" ? 1 : 2,
                            },
                          })
                        }
                        options={[
                          { value: "1", label: "One" },
                          { value: "2", label: "Two" },
                        ]}
                      />
                    </label>
                    <label htmlFor="analytics-dashboard-spacing">
                      Spacing
                      <OptionSelect
                        id="analytics-dashboard-spacing"
                        ariaLabel="Spacing"
                        value={dashboardDraft.styles.spacing}
                        onValueChange={(value) =>
                          updateDashboard({
                            styles: {
                              ...dashboardDraft.styles,
                              spacing:
                                value as DashboardDefinition["styles"]["spacing"],
                            },
                          })
                        }
                        options={[
                          { value: "compact", label: "Compact" },
                          { value: "regular", label: "Regular" },
                          { value: "relaxed", label: "Relaxed" },
                        ]}
                      />
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
