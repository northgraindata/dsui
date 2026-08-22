import { Button, cn, Field, Input, Status, Surface } from "@dsui/ui";
import {
  Link,
  Outlet,
  useNavigate,
  useParams,
  useRouterState,
} from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  type Adapter,
  createService,
  getAdapters,
  getManifest,
  getServices,
  login,
  normalizeRenderer,
  type Renderer,
  type RendererKind,
  runOperation,
  type Service,
  setupOwner,
  testService,
  titleFor,
} from "./api";
import { BrandGlyph } from "./logos";

const nav = [
  { icon: "grid", label: "Stack", to: "/" },
  { icon: "plug", label: "Services", to: "/" },
  { icon: "gear", label: "Settings", to: "/" },
];
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    plug: <path d="M9 7v6m6-6v6M7 13h10v2a5 5 0 0 1-10 0v-2Zm5 7v2" />,
    gear: (
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12.5v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.05 16.95l-1.41 1.41m12.72 0-1.42-1.41M7.05 7.05 5.64 5.64" />
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4 4" />
      </>
    ),
    command: <path d="M18 8a6 6 0 1 0 0 8M6 8a6 6 0 1 1 0 8" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    terminal: (
      <>
        <path d="m5 7 4 5-4 5M12 17h7" />
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path d="M5 5v7c0 1.66 3.13 3 7 3s7-1.34 7-3V5m-14 7v7c0 1.66 3.13 3 7 3s7-1.34 7-3v-7" />
      </>
    ),
    folder: (
      <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Z" />
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.grid}
    </svg>
  );
}

function useShortcut(key: string, fn: () => void) {
  useEffect(() => {
    const h = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key) {
        event.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [key, fn]);
}

export function AppShell() {
  const [command, setCommand] = useState(false);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isAuthPage = pathname === "/login" || pathname === "/setup";
  useShortcut("k", () => {
    if (!isAuthPage) setCommand(true);
  });
  if (isAuthPage) return <Outlet />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="wordmark" aria-label="dsui home">
          <span>ds</span>ui
        </Link>
        <nav>
          {nav.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="sidebar-link"
              activeProps={{ className: "sidebar-link is-active" }}
            >
              <Icon name={item.icon} /> <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="command-trigger" onClick={() => setCommand(true)}>
            <Icon name="command" /> Command <kbd>⌘ K</kbd>
          </button>
          <div className="user-chip">
            <span>DS</span>
            <div>
              <b>Workspace</b>
              <small>Local installation</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setCommand(true)}
            aria-label="Open command palette"
          >
            <Icon name="command" />
          </button>
          <div className="topbar-status">
            <span className="live-dot" /> Local workspace
          </div>
          <Button asChild size="small">
            <Link to="/services/new">
              <Icon name="plus" /> Add service
            </Link>
          </Button>
        </header>
        <Outlet />
      </main>
      {command && <CommandPalette close={() => setCommand(false)} />}
    </div>
  );
}

function CommandPalette({ close }: { close: () => void }) {
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const go = (to: string) => {
    close();
    navigate({ to: to as never });
  };
  useEffect(() => {
    getServices()
      .then(setServices)
      .catch(() => setServices([]));
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    addEventListener("keydown", h);
    return () => removeEventListener("keydown", h);
  }, [close]);
  return (
    <div className="palette-backdrop" onMouseDown={close}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="palette-search">
          <Icon name="search" />
          <input autoFocus placeholder="Search commands…" />
        </div>
        <p>Navigate</p>
        <button onClick={() => go("/")}>
          <Icon name="grid" /> Dashboard <kbd>↵</kbd>
        </button>
        <button onClick={() => go("/services/new")}>
          <Icon name="plus" /> Add service
        </button>
        {services.length > 0 && <p>Services</p>}
        {services.map((s) => (
          <button key={s.id} onClick={() => go(`/services/${s.id}`)}>
            <ServiceMark adapter={s.adapter} logo={s.logo} /> {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Dashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  useEffect(() => {
    getServices()
      .then(setServices)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load services."),
      )
      .finally(() => setLoading(false));
  }, []);
  const healthy = services.filter((x) => x.health === "healthy").length;
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Data stack</p>
          <h1>Connected services</h1>
          <p>Health and access for your local data stack.</p>
        </div>
        {!error && (
          <div className="stack-summary">
            <Status
              state={
                services.length && healthy === services.length
                  ? "healthy"
                  : "unknown"
              }
              label={`${healthy}/${services.length} healthy`}
            />
          </div>
        )}
      </div>
      {error ? (
        <UnavailableState detail={error} />
      ) : (
        <Surface className="services-table">
          <div className="service-table-head">
            <span>Service</span>
            <span>Type</span>
            <span>Status</span>
          </div>
          {loading ? (
            <div className="table-empty">Checking services…</div>
          ) : services.length ? (
            services.map((service) => (
              <ServiceRow service={service} key={service.id} />
            ))
          ) : (
            <div className="table-empty">No services connected yet.</div>
          )}
        </Surface>
      )}
      <p className="page-footnote">
        Services loaded from <code>dsui.yaml</code> are managed by configuration
        and remain read-only.
      </p>
    </div>
  );
}
function ServiceMark({ adapter, logo }: { adapter: string; logo?: string }) {
  const [failed, setFailed] = useState(false);
  const classes = cn("service-mark", `service-mark--${adapter}`);
  if (logo && !failed)
    return (
      <span className={classes}>
        <img src={logo} alt="" loading="lazy" onError={() => setFailed(true)} />
      </span>
    );
  const glyph = <BrandGlyph adapter={adapter} />;
  if (glyph) return <span className={cn(classes, "is-brand")}>{glyph}</span>;
  return <span className={classes}>{adapter.slice(0, 2).toUpperCase()}</span>;
}
function ServiceRow({ service }: { service: Service }) {
  return (
    <Link
      to="/services/$serviceId"
      params={{ serviceId: service.id }}
      className="service-row"
    >
      <div className="service-name">
        <ServiceMark adapter={service.adapter} logo={service.logo} />
        <div>
          <b>{service.name}</b>
          <code>{service.endpoint}</code>
        </div>
      </div>
      <span className="service-category">{service.category}</span>
      <div className="service-health">
        <Status state={service.health} label={service.health} />
        <small>
          {service.latencyMs
            ? `${service.latencyMs}ms`
            : (service.detail ?? "")}
        </small>
      </div>
      <Icon name="chevron" />
    </Link>
  );
}

export function AddService() {
  const nav = useNavigate();
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [selected, setSelected] = useState<Adapter | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [loadError, setLoadError] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getAdapters()
      .then(setAdapters)
      .catch((e) =>
        setLoadError(
          e instanceof Error ? e.message : "Could not load adapters.",
        ),
      );
  }, []);
  const update = (key: string, value: string) =>
    setValues((x) => ({ ...x, [key]: value }));
  const input = selected
    ? {
        adapter: selected.id,
        name: values.name || selected.name,
        connection: values,
      }
    : null;
  async function test() {
    if (!input) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const status = await testService(input);
      setMessage(
        status.health === "healthy"
          ? `Connection healthy${status.latencyMs ? ` · ${status.latencyMs}ms` : ""}`
          : (status.detail ?? "Connection could not be verified"),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Connection test failed",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!input) return;
    setBusy(true);
    try {
      const service = await createService(input);
      nav({ to: "/services/$serviceId", params: { serviceId: service.id } });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save service",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page narrow">
      <Link to="/" className="back-link">
        ← Back to services
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Add service</p>
          <h1>{selected ? `Connect ${selected.name}` : "Choose an adapter"}</h1>
          <p>
            {selected
              ? selected.description
              : "Select the service you want dsui to connect to."}
          </p>
        </div>
      </div>
      {loadError ? (
        <UnavailableState detail={loadError} />
      ) : !selected ? (
        <div className="adapter-grid">
          {adapters.map((adapter) => (
            <button
              key={adapter.id}
              className="adapter-choice"
              onClick={() => {
                setSelected(adapter);
                setValues({ name: adapter.name });
              }}
            >
              <ServiceMark adapter={adapter.id} logo={adapter.logo} />
              <div>
                <b>{adapter.name}</b>
                <span>{adapter.category}</span>
              </div>
              <p>{adapter.description}</p>
              <Icon name="chevron" />
            </button>
          ))}
        </div>
      ) : (
        <form className="connection-form" onSubmit={save}>
          <Surface>
            <div className="form-body">
              <Field label="Service name" hint="Shown in your service list.">
                <Input
                  value={values.name ?? ""}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </Field>
              {selected.fields.map((field) => (
                <Field key={field.key} label={field.label}>
                  <Input
                    type={field.type ?? "text"}
                    value={values[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(e) => update(field.key, e.target.value)}
                    required={field.required ?? true}
                  />
                </Field>
              ))}
            </div>
            <div className="form-actions">
              {message && (
                <span
                  className={
                    message.startsWith("Connection healthy")
                      ? "test-success"
                      : "test-error"
                  }
                >
                  {message}
                </span>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={test}
                disabled={busy}
              >
                Test connection
              </Button>
              <Button type="submit" disabled={busy}>
                Save service
              </Button>
            </div>
          </Surface>
        </form>
      )}
    </div>
  );
}

type ServiceViewDefinition = {
  id: string;
  title: string;
  renderer: RendererKind;
  capability: string;
};
export function ServiceDetail() {
  const { serviceId } = useParams({ from: "/services/$serviceId" });
  return <ServiceScreen serviceId={serviceId} />;
}
export function ServiceView() {
  const { serviceId, viewId } = useParams({
    from: "/services/$serviceId/$viewId",
  });
  return <ServiceScreen serviceId={serviceId} viewId={viewId} />;
}
function ServiceScreen({
  serviceId,
  viewId,
}: {
  serviceId: string;
  viewId?: string;
}) {
  const [service, setService] = useState<Service>();
  const [views, setViews] = useState<ServiceViewDefinition[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    Promise.all([getServices(), getManifest(serviceId)])
      .then(([all, manifest]) => {
        if (!active) return;
        setService(all.find((x) => x.id === serviceId));
        setViews(manifest.views);
      })
      .catch(
        (e) =>
          active &&
          setError(e instanceof Error ? e.message : "Could not load service."),
      );
    return () => {
      active = false;
    };
  }, [serviceId]);
  if (error)
    return (
      <div className="page">
        <UnavailableState detail={error} />
      </div>
    );
  if (!service)
    return (
      <div className="page">
        <div className="table-empty">Loading service…</div>
      </div>
    );
  const view = views.find((item) => item.id === viewId);
  return (
    <div className="detail-layout">
      <aside className="service-nav">
        <Link to="/" className="back-link">
          ← All services
        </Link>
        <div className="service-identity">
          <ServiceMark adapter={service.adapter} logo={service.logo} />
          <div>
            <b>{service.name}</b>
            <code>{service.endpoint}</code>
          </div>
        </div>
        <Status state={service.health} label={service.health} />
        <hr />
        {views.map((item) => (
          <Link
            key={item.id}
            to="/services/$serviceId/$viewId"
            params={{ serviceId, viewId: item.id }}
            className={cn(
              "service-nav-item",
              viewId === item.id && "is-active",
            )}
          >
            <Icon name={iconFor(normalizeRenderer(item.renderer))} />
            {item.title}
          </Link>
        ))}
      </aside>
      <div className="service-content">
        <div className="detail-title">
          <div>
            <p className="eyebrow">{service.category}</p>
            <h1>{view?.title ?? service.name}</h1>
          </div>
          <Status
            state={service.health}
            label={
              service.latencyMs
                ? `${service.latencyMs}ms`
                : (service.detail ?? service.health)
            }
          />
        </div>
        {view ? (
          <CapabilityRenderer service={service} view={view} />
        ) : (
          <EmptyState
            title="Choose a capability"
            detail="Select a capability from the service navigation to begin."
          />
        )}
      </div>
    </div>
  );
}
function iconFor(renderer: Renderer) {
  return renderer.includes("query")
    ? "terminal"
    : renderer.includes("object") ||
        renderer.includes("schema") ||
        renderer.includes("table")
      ? "folder"
      : "database";
}
function CapabilityRenderer({
  service,
  view,
}: {
  service: Service;
  view: ServiceViewDefinition;
}) {
  const renderer = normalizeRenderer(view.renderer);
  if (renderer === "query-workbench")
    return <QueryView service={service} capability={view.capability} />;
  if (renderer === "action-form")
    return <ActionView service={service} capability={view.capability} />;
  return (
    <RecordsView
      service={service}
      capability={view.capability}
      title={view.title}
      renderer={renderer}
    />
  );
}
function QueryView({
  service,
  capability,
}: {
  service: Service;
  capability: string;
}) {
  const [query, setQuery] = useState(
    "SELECT *\nFROM system.runtime.nodes\nLIMIT 100",
  );
  const [result, setResult] = useState<unknown>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  async function run() {
    setRunning(true);
    setError(undefined);
    try {
      setResult(await runOperation(service.id, capability, { sql: query }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setRunning(false);
    }
  }
  const rows = (result as { data?: { rows?: unknown[][]; data?: unknown[][] } })
    ?.data;
  const resultRows = rows?.rows ?? rows?.data;
  return (
    <div className="capability">
      <Surface className="query-surface">
        <div className="editor-title">
          <span>
            <Icon name="terminal" /> SQL
          </span>
          <Button size="small" onClick={run} disabled={running}>
            {running ? "Running…" : "Run query"}
          </Button>
        </div>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          aria-label="SQL query"
        />
      </Surface>
      {error ? (
        <div className="inline-error">{error}</div>
      ) : resultRows ? (
        <ResultTable rows={resultRows} />
      ) : (
        <EmptyState
          title="Run a query"
          detail="Results stay in this browser session and are not written to dsui."
        />
      )}
    </div>
  );
}
function RecordsView({
  service,
  capability,
  title,
  renderer,
}: {
  service: Service;
  capability: string;
  title: string;
  renderer: Renderer;
}) {
  const [data, setData] = useState<unknown>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    runOperation(service.id, capability, {})
      .then(setData)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load data"),
      );
  }, [capability, service.id]);
  if (error)
    return (
      <EmptyState
        title={`Could not load ${title.toLowerCase()}`}
        detail={error}
      />
    );
  const records = (data as { data?: unknown[] })?.data;
  return (
    <div className="capability">
      {records ? (
        <ResultTable
          rows={records.map((row) =>
            Array.isArray(row) ? row : Object.values(row as object),
          )}
        />
      ) : (
        <Surface className="loading-surface">
          <span className="loading-line" />
          <span className="loading-line short" />
          <span className="loading-line" />
        </Surface>
      )}
      <p className="page-footnote">
        {renderer.replaceAll("-", " ")} · server-side operation
      </p>
    </div>
  );
}
function ActionView({
  service,
  capability,
}: {
  service: Service;
  capability: string;
}) {
  const [result, setResult] = useState<string>();
  return (
    <Surface className="action-surface">
      <h2>Run {titleFor(capability)}</h2>
      <p>
        This operation is performed server-side with your service connection.
      </p>
      <Button
        onClick={() =>
          runOperation(service.id, capability, {})
            .then(() => setResult("Operation completed."))
            .catch((e) => setResult(e.message))
        }
      >
        Run operation
      </Button>
      {result && <p className="page-footnote">{result}</p>}
    </Surface>
  );
}
function ResultTable({ rows }: { rows: unknown[][] }) {
  return (
    <Surface className="result-table">
      <div className="result-table__head">
        <span>Result</span>
        <span>{rows.length} rows</span>
      </div>
      {rows.length ? (
        <div className="result-scroll">
          <table>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-empty">No records returned.</div>
      )}
    </Surface>
  );
}
function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <Icon name="database" size={24} />
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}
function UnavailableState({ detail }: { detail: string }) {
  return (
    <div className="unavailable-state" role="alert">
      <Status state="unavailable" label="API unavailable" />
      <h2>dsui could not load this data</h2>
      <p>{detail}</p>
      <Button
        variant="secondary"
        size="small"
        onClick={() => window.location.reload()}
      >
        Retry
      </Button>
    </div>
  );
}

function AuthFrame({
  title,
  copy,
  children,
}: {
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-page">
      <Link to="/" className="wordmark">
        <span>ds</span>ui
      </Link>
      <Surface className="auth-card">
        <p className="eyebrow">Data Stack UI</p>
        <h1>{title}</h1>
        <p>{copy}</p>
        {children}
      </Surface>
    </div>
  );
}
export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await login({ email, password });
      await navigate({ to: "/" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      title="Sign in"
      copy="Use your local workspace account to continue."
    >
      <form className="auth-form" onSubmit={submit}>
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field label="Password" error={error}>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="auth-note">
        Authentication is configured by this dsui instance.
      </p>
    </AuthFrame>
  );
}
export function Setup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await setupOwner({ email, password });
      await navigate({ to: "/" });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create owner account",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      title="Create the owner account"
      copy="This account administers this local dsui workspace."
    >
      <form className="auth-form" onSubmit={submit}>
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field
          label="Password"
          hint="Use at least 12 characters."
          error={error}
        >
          <Input
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthFrame>
  );
}
