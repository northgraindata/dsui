import {
  Button,
  cn,
  Field,
  Input,
  Status,
  Surface,
} from "@northgraindata/dsui-ui";
import {
  Link,
  Outlet,
  useNavigate,
  useParams,
  useRouterState,
} from "@tanstack/react-router";
import {
  type FormEvent,
  Fragment,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
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

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        "mx-2.5 mb-8 inline-flex items-baseline text-[19px] font-bold tracking-tight text-primary no-underline",
        className,
      )}
      aria-label="dsui home"
    >
      <span className="text-accent">ds</span>ui
      <span className="wordmark-cursor text-accent">_</span>
    </Link>
  );
}

const navLink =
  "flex h-8 items-center gap-2.5 px-2.5 text-[12px] no-underline transition-colors hover:bg-surface-hover hover:text-primary";

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
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="sticky top-0 flex h-screen flex-col border-r border-border bg-canvas px-3 py-5">
        <Wordmark />
        <nav className="grid gap-px">
          {nav.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={cn(navLink, "text-muted")}
              activeProps={{ className: cn(navLink, "text-primary") }}
            >
              <Icon name={item.icon} /> <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-3">
          <button
            type="button"
            className="flex h-8 items-center gap-2 border border-border-strong bg-transparent px-2.5 text-[11px] text-secondary transition-colors hover:border-muted hover:text-primary"
            onClick={() => setCommand(true)}
          >
            <Icon name="command" /> Command{" "}
            <kbd className="ml-auto border border-border bg-background px-1 py-0.5 font-mono text-[10px] text-muted">
              ⌘ K
            </kbd>
          </button>
          <div className="flex items-center gap-2.5 border border-border bg-background p-2">
            <span className="flex size-7 shrink-0 items-center justify-center bg-accent/15 font-mono text-[10px] font-semibold text-accent">
              DS
            </span>
            <div className="min-w-0 leading-tight">
              <b className="block truncate text-[11.5px] font-semibold text-primary">
                Workspace
              </b>
              <small className="block truncate font-mono text-[10px] text-muted">
                Local installation
              </small>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex h-12 items-center gap-4 border-b border-border bg-canvas/90 px-5 backdrop-blur">
          <button
            type="button"
            className="text-secondary transition-colors hover:text-primary"
            onClick={() => setCommand(true)}
            aria-label="Open command palette"
          >
            <Icon name="command" />
          </button>
          <div className="ml-auto flex items-center gap-2 font-mono text-[11px] text-secondary">
            <span className="size-1.5 animate-pulse bg-healthy" /> Local
            workspace
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

const pageClass =
  "mx-auto w-full max-w-5xl flex-1 px-6 py-6 [&_code]:font-mono";

export function PageHeading({
  eyebrow,
  title,
  detail,
  aside,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-[17px] font-semibold text-primary">{title}</h1>
        {detail && (
          <p className="mt-1 max-w-xl text-[12px] text-secondary">{detail}</p>
        )}
      </div>
      {aside}
    </div>
  );
}

const paletteRow =
  "flex h-8 w-full items-center gap-2.5 border-0 bg-transparent px-3 text-left text-[12px] text-secondary transition-colors hover:bg-surface-hover hover:text-primary";

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
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop dismisses on outside press; the dialog itself carries the semantic role
    <div
      className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={close}
    >
      <div
        className="mx-auto mt-[15vh] w-full max-w-md border border-border-strong bg-surface-raised shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 items-center gap-2.5 border-b border-border px-3 text-muted focus-within:border-accent">
          <Icon name="search" />
          <input
            ref={(el) => el?.focus()}
            placeholder="Search commands…"
            className="h-full w-full border-0 bg-transparent font-mono text-[12px] text-primary outline-none placeholder:text-muted"
          />
        </div>
        <div className="max-h-80 overflow-auto p-1.5">
          <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Navigate
          </p>
          <button type="button" className={paletteRow} onClick={() => go("/")}>
            <Icon name="grid" /> Dashboard{" "}
            <kbd className="ml-auto font-mono text-[10px] text-muted">↵</kbd>
          </button>
          <button
            type="button"
            className={paletteRow}
            onClick={() => go("/services/new")}
          >
            <Icon name="plus" /> Add service
          </button>
          {services.length > 0 && (
            <p className="px-3 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              Services
            </p>
          )}
          {services.map((s) => (
            <button
              type="button"
              key={s.id}
              className={paletteRow}
              onClick={() => go(`/services/${s.id}`)}
            >
              <ServiceMark adapter={s.adapter} logo={s.logo} /> {s.name}
            </button>
          ))}
        </div>
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
    <div className={pageClass}>
      <PageHeading
        eyebrow="Data stack"
        title="Connected services"
        detail="Health and access for your local data stack."
        aside={
          !error && (
            <Status
              state={
                services.length && healthy === services.length
                  ? "healthy"
                  : "unknown"
              }
              label={`${healthy}/${services.length} healthy`}
            />
          )
        }
      />
      {error ? (
        <UnavailableState detail={error} />
      ) : (
        <Surface className="divide-y divide-border overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_140px_190px_16px] items-center gap-3 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            <span>Service</span>
            <span>Type</span>
            <span>Status</span>
            <span />
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center font-mono text-[11px] text-muted">
              Checking services…
            </div>
          ) : services.length ? (
            services.map((service) => (
              <ServiceRow service={service} key={service.id} />
            ))
          ) : (
            <div className="px-4 py-8 text-center font-mono text-[11px] text-muted">
              No services connected yet.
            </div>
          )}
        </Surface>
      )}
      <p className="mt-4 font-mono text-[10.5px] text-muted">
        Services loaded from <code>dsui.yaml</code> are managed by configuration
        and remain read-only.
      </p>
    </div>
  );
}

function ServiceMark({
  adapter,
  logo,
  size = 26,
}: {
  adapter: string;
  logo?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const classes =
    "relative flex shrink-0 items-center justify-center border border-border bg-surface-raised text-secondary";
  const style = { width: size, height: size };
  if (logo && !failed)
    return (
      <span className={classes} style={style}>
        <img
          src={logo}
          alt=""
          width={size - 8}
          height={size - 8}
          loading="lazy"
          className="object-contain p-1"
          onError={() => setFailed(true)}
        />
      </span>
    );
  const glyph = <BrandGlyph adapter={adapter} size={size - 8} />;
  if (glyph)
    return (
      <span className={cn(classes, "text-accent")} style={style}>
        {glyph}
      </span>
    );
  return (
    <span
      className={cn(classes, "font-mono text-[9.5px] font-semibold")}
      style={style}
    >
      {adapter.slice(0, 2).toUpperCase()}
    </span>
  );
}

const rowGrid =
  "grid grid-cols-[minmax(0,1fr)_140px_190px_16px] items-center gap-3";

function ServiceRow({ service }: { service: Service }) {
  return (
    <Link
      to="/services/$serviceId"
      params={{ serviceId: service.id }}
      className={cn(
        rowGrid,
        "group px-4 py-2.5 no-underline transition-colors hover:bg-surface-hover",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <ServiceMark adapter={service.adapter} logo={service.logo} />
        <div className="min-w-0 leading-tight">
          <b className="block truncate text-[12.5px] font-medium text-primary">
            {service.name}
          </b>
          <code className="block truncate font-mono text-[11px] text-muted">
            {service.endpoint}
          </code>
        </div>
      </div>
      <span className="truncate text-[11.5px] text-secondary">
        {service.category}
      </span>
      <div className="min-w-0">
        <Status state={service.health} label={service.health} />
        <small className="mt-0.5 block truncate font-mono text-[10.5px] text-muted">
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
    <div className={cn(pageClass, "max-w-xl")}>
      <Link
        to="/"
        className="mb-4 inline-block font-mono text-[11px] text-secondary no-underline hover:text-primary"
      >
        ← Back to services
      </Link>
      <PageHeading
        eyebrow="Add service"
        title={selected ? `Connect ${selected.name}` : "Choose an adapter"}
        detail={
          selected
            ? selected.description
            : "Select the service you want dsui to connect to."
        }
      />
      {loadError ? (
        <UnavailableState detail={loadError} />
      ) : !selected ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {adapters.map((adapter) => (
            <button
              type="button"
              key={adapter.id}
              className="group relative flex flex-col gap-2 border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
              onClick={() => {
                setSelected(adapter);
                setValues({ name: adapter.name });
              }}
            >
              <div className="flex items-center gap-3">
                <ServiceMark adapter={adapter.id} logo={adapter.logo} />
                <div className="leading-tight">
                  <b className="block text-[13px] font-medium text-primary">
                    {adapter.name}
                  </b>
                  <span className="font-mono text-[10.5px] text-muted">
                    {adapter.category}
                  </span>
                </div>
                <span className="ml-auto text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent">
                  <Icon name="chevron" />
                </span>
              </div>
              <p className="m-0 text-[11.5px] leading-relaxed text-secondary">
                {adapter.description}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={save}>
          <Surface>
            <div className="grid gap-4 p-5">
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
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-dashed border-border px-5 py-4">
              {message && (
                <span
                  className={cn(
                    "mr-auto font-mono text-[11px]",
                    message.startsWith("Connection healthy")
                      ? "text-healthy"
                      : "text-unavailable",
                  )}
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
  kind?: string;
  description?: string;
  columns?: Array<{ id: string; label: string; format?: string }>;
  actions?: Array<{ id: string; label: string; authorization: string }>;
  filters?: Array<{ id: string; label: string; type: string }>;
  detail?: string;
  idField?: string;
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

/**
 * Primary-screen renderers keyed by the server-declared `renderer` kind.
 * Adapters opt into these purely through their `view.kind` declaration; no
 * per-adapter branching lives here, so external adapters work automatically.
 */
const SCREEN_REGISTRY: Record<
  string,
  (props: {
    service: Service;
    view: ServiceViewDefinition;
    views: ServiceViewDefinition[];
  }) => ReactElement
> = {
  "query-workbench": ({ service }) => <QueryWorkbench service={service} />,
  "object-browser": ({ service }) => <S3Browser service={service} />,
  "message-browser": ({ service }) => <KafkaBrowser service={service} />,
  "job-browser": ({ service, view, views }) => (
    <JobBrowser service={service} view={view} views={views} />
  ),
};
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
      <div className={pageClass}>
        <UnavailableState detail={error} />
      </div>
    );
  if (!service)
    return (
      <div className={pageClass}>
        <div className="py-10 text-center font-mono text-[11px] text-muted">
          Loading service…
        </div>
      </div>
    );
  const activeView =
    views.find((item) => item.id === viewId) ??
    views.find((item) => SCREEN_REGISTRY[item.renderer]) ??
    views[0];
  if (activeView && SCREEN_REGISTRY[activeView.renderer])
    return SCREEN_REGISTRY[activeView.renderer]({
      service,
      view: activeView,
      views,
    });
  const view = activeView;
  return (
    <div className="grid flex-1 grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto border-r border-border bg-canvas px-3 py-5">
        <Link
          to="/"
          className="mx-1 inline-block font-mono text-[10.5px] text-muted no-underline hover:text-primary"
        >
          ← All services
        </Link>
        <div className="mx-1 mt-5 flex items-center gap-3">
          <ServiceMark adapter={service.adapter} logo={service.logo} />
          <div className="min-w-0 leading-tight">
            <b className="block truncate text-[12.5px] font-medium text-primary">
              {service.name}
            </b>
            <code className="block truncate font-mono text-[10.5px] text-muted">
              {service.endpoint}
            </code>
          </div>
        </div>
        <div className="mx-1 mt-3">
          <Status state={service.health} label={service.health} />
        </div>
        <hr className="my-4 border-t border-dashed border-border" />
        <nav className="grid gap-px">
          {views.map((item) => (
            <Link
              key={item.id}
              to="/services/$serviceId/$viewId"
              params={{ serviceId, viewId: item.id }}
              className={cn(
                navLink,
                viewId === item.id
                  ? "bg-surface-hover text-primary"
                  : "text-muted",
              )}
            >
              <Icon name={iconFor(normalizeRenderer(item.renderer))} />
              {item.title}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 px-6 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              {service.category}
            </p>
            <h1 className="mt-1 text-[17px] font-semibold text-primary">
              {view?.title ?? service.name}
            </h1>
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
    <div className="grid gap-4">
      <Surface className="overflow-hidden">
        <div className="flex h-9 items-center justify-between border-b border-border px-3">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
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
          className="block h-40 w-full resize-y border-0 bg-canvas p-4 font-mono text-[12px] leading-relaxed text-primary outline-none"
        />
      </Surface>
      {error ? (
        <div className="border border-unavailable/40 bg-unavailable/10 p-3 font-mono text-[11.5px] text-unavailable">
          {error}
        </div>
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
    <div className="grid gap-4">
      {records ? (
        <ResultTable
          rows={records.map((row) =>
            Array.isArray(row) ? row : Object.values(row as object),
          )}
        />
      ) : (
        <Surface className="grid gap-2.5 p-5">
          <span className="loading-line" />
          <span className="loading-line short" />
          <span className="loading-line" />
        </Surface>
      )}
      <p className="font-mono text-[10.5px] text-muted">
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
    <Surface className="grid max-w-lg gap-2 p-5">
      <h2 className="m-0 text-[14px] font-semibold text-primary">
        Run {titleFor(capability)}
      </h2>
      <p className="m-0 text-[12px] text-secondary">
        This operation is performed server-side with your service connection.
      </p>
      <div className="mt-2">
        <Button
          onClick={() =>
            runOperation(service.id, capability, {})
              .then(() => setResult("Operation completed."))
              .catch((e) => setResult(e.message))
          }
        >
          Run operation
        </Button>
      </div>
      {result && (
        <p className="m-0 font-mono text-[11px] text-muted">{result}</p>
      )}
    </Surface>
  );
}
function ResultTable({
  rows,
  columns,
}: {
  rows: unknown[][];
  columns?: string[];
}) {
  return (
    <Surface className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        <span>Result</span>
        <span>{rows.length} rows</span>
      </div>
      {rows.length || columns ? (
        <div className="max-h-[460px] overflow-auto">
          <table className="w-full border-collapse font-mono text-[11.5px]">
            {columns?.length ? (
              <thead className="sticky top-0 z-10 bg-canvas">
                <tr className="border-b border-border">
                  {columns.map((col, j) => (
                    <th
                      // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional result metadata
                      key={j}
                      className="border-b border-border px-3 py-2 text-left font-semibold text-secondary"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {rows.map((row, i) => (
                <tr
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional result data without stable ids
                  key={i}
                  className="border-b border-border/60 last:border-b-0 hover:bg-surface-hover/60"
                >
                  {row.map((cell, j) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional result data without stable ids
                      key={j}
                      className="max-w-[320px] truncate whitespace-pre px-3 py-1.5 align-top text-secondary"
                    >
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-8 text-center font-mono text-[11px] text-muted">
          No records returned.
        </div>
      )}
    </Surface>
  );
}
function usePolling(
  serviceId: string,
  capability: string,
  intervalMs: number,
  enabled = true,
): { data?: unknown; columns?: string[]; error?: string } {
  const [state, setState] = useState<{
    data?: unknown;
    columns?: string[];
    error?: string;
  }>({});
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = () =>
      runOperation(serviceId, capability, {})
        .then((res) => {
          if (active) setState({ data: res.data, columns: res.columns });
        })
        .catch(
          (e) =>
            active &&
            setState({
              error: e instanceof Error ? e.message : "Failed to load",
            }),
        );
    load();
    const timer = setInterval(load, intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [serviceId, capability, intervalMs, enabled]);
  return state;
}

function ObjectExplorer({
  service,
  onPick,
}: {
  service: Service;
  onPick: (qualifiedName: string) => void;
}) {
  type Tree = Array<{
    catalog: string;
    schemas: Array<{ schema: string; tables: string[] }>;
  }>;
  const [tree, setTree] = useState<Tree>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      runOperation(service.id, "schemas", {}),
      runOperation(service.id, "tables", {}),
    ])
      .then(([schemasRes, tablesRes]) => {
        if (!active) return;
        const schemas = (schemasRes.data as unknown[][]) ?? [];
        const tables = (tablesRes.data as unknown[][]) ?? [];
        const catalogMap = new Map<string, Map<string, string[]>>();
        const schemaFor = (catalog: string) => {
          let m = catalogMap.get(catalog);
          if (!m) {
            m = new Map();
            catalogMap.set(catalog, m);
          }
          return m;
        };
        const tablesFor = (catalog: string, schema: string) => {
          const m = schemaFor(catalog);
          let t = m.get(schema);
          if (!t) {
            t = [];
            m.set(schema, t);
          }
          return t;
        };
        for (const row of schemas as [string, string][]) {
          tablesFor(row[0], row[1]);
        }
        for (const row of tables as [string, string, string][]) {
          tablesFor(row[0], row[1]).push(row[2]);
        }
        const built: Tree = [...catalogMap.entries()].map(
          ([catalog, schemas]) => ({
            catalog,
            schemas: [...schemas.entries()].map(([schema, tables]) => ({
              schema,
              tables,
            })),
          }),
        );
        setTree(built);
        setOpen(
          new Set(
            built.length === 1
              ? [built[0].catalog]
              : built.map((t) => t.catalog),
          ),
        );
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load objects"),
      )
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [service.id]);
  const needle = filter.trim().toLowerCase();
  const filtered = needle
    ? tree
        .map((c) => ({
          catalog: c.catalog,
          schemas: c.schemas
            .map((s) => ({
              schema: s.schema,
              tables: s.tables.filter((t) =>
                `${c.catalog}.${s.schema}.${t}`.toLowerCase().includes(needle),
              ),
            }))
            .filter((s) => s.tables.length > 0),
        }))
        .filter((c) => c.schemas.length > 0)
    : tree;
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <aside className="flex h-[calc(100vh-3rem)] flex-col border-r border-border bg-canvas">
      <div className="border-b border-border px-3 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          Library
        </p>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter objects"
          className="mt-2 w-full border border-border bg-background px-2 py-1.5 font-mono text-[11px] text-primary outline-none focus:border-muted"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2 font-mono text-[11.5px]">
        {error ? (
          <p className="px-2 py-3 text-[11px] text-unavailable">{error}</p>
        ) : loading ? (
          <div className="space-y-1.5 px-2 py-3">
            <span className="loading-line" />
            <span className="loading-line short" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-muted">No objects.</p>
        ) : (
          filtered.map((cat) => {
            const catKey = cat.catalog;
            const catOpen = open.has(catKey) || needle.length > 0;
            return (
              <div key={catKey}>
                <button
                  type="button"
                  onClick={() => toggle(catKey)}
                  className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-secondary hover:bg-surface-hover hover:text-primary"
                >
                  <Icon name="chevron" size={12} />
                  <Icon name="database" size={13} />
                  <span className="truncate">{cat.catalog}</span>
                </button>
                {catOpen &&
                  cat.schemas.map((sch) => {
                    const schKey = `${cat.catalog}/${sch.schema}`;
                    const schOpen = open.has(schKey) || needle.length > 0;
                    return (
                      <div key={schKey}>
                        <button
                          type="button"
                          onClick={() => toggle(schKey)}
                          className="flex w-full items-center gap-1.5 rounded py-1 pl-5 pr-1.5 text-left text-secondary hover:bg-surface-hover hover:text-primary"
                        >
                          <Icon name="chevron" size={12} />
                          <Icon name="folder" size={13} />
                          <span className="truncate">{sch.schema}</span>
                        </button>
                        {schOpen &&
                          sch.tables.map((tbl) => (
                            <button
                              type="button"
                              key={tbl}
                              onClick={() =>
                                onPick(`${cat.catalog}.${sch.schema}.${tbl}`)
                              }
                              title={`${cat.catalog}.${sch.schema}.${tbl}`}
                              className="flex w-full items-center gap-1.5 rounded py-1 pl-10 pr-1.5 text-left text-muted hover:bg-surface-hover hover:text-primary"
                            >
                              <Icon name="grid" size={12} />
                              <span className="truncate">{tbl}</span>
                            </button>
                          ))}
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function QueryWorkbench({ service }: { service: Service }) {
  const [query, setQuery] = useState(
    "SELECT *\nFROM system.runtime.nodes\nLIMIT 100",
  );
  const [rows, setRows] = useState<unknown[][]>([]);
  const [columns, setColumns] = useState<string[]>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const kpis = usePolling(service.id, "metrics", 3000);
  const liveQueries = usePolling(service.id, "running-queries", 3000);
  function insertName(name: string) {
    const el = editorRef.current;
    if (!el) {
      setQuery((q) => `${q} ${name}`);
      return;
    }
    const start = el.selectionStart ?? query.length;
    const end = el.selectionEnd ?? query.length;
    const next = query.slice(0, start) + name + query.slice(end);
    setQuery(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + name.length;
      el.setSelectionRange(pos, pos);
    });
  }
  async function run() {
    setRunning(true);
    setError(undefined);
    try {
      const res = await runOperation(service.id, "query", { sql: query });
      setColumns(res.columns?.length ? res.columns : undefined);
      setRows((res.data as unknown[][]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed");
      setRows([]);
      setColumns(undefined);
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className="grid flex-1 grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
      <ObjectExplorer service={service} onPick={insertName} />
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <Link
            to="/"
            className="font-mono text-[10.5px] text-muted no-underline hover:text-primary"
          >
            ← All services
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ServiceMark
              adapter={service.adapter}
              logo={service.logo}
              size={18}
            />
            <b className="text-[12.5px] font-medium text-primary">
              {service.name}
            </b>
            <Status state={service.health} label={service.health} />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-5">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.error ? (
              <span className="col-span-full font-mono text-[11px] text-unavailable">
                {kpis.error}
              </span>
            ) : kpis.data ? (
              (kpis.data as Array<{ label: string; value: unknown }>).map(
                (m) => (
                  <Surface key={m.label} className="grid gap-1 p-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      {m.label}
                    </span>
                    <span className="text-[20px] font-semibold text-primary">
                      {String(m.value)}
                    </span>
                  </Surface>
                ),
              )
            ) : (
              <span className="col-span-full font-mono text-[11px] text-muted">
                Loading metrics…
              </span>
            )}
          </section>
          <Surface className="overflow-hidden">
            <div className="flex h-9 items-center justify-between border-b border-border px-3">
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                <Icon name="terminal" /> SQL
              </span>
              <Button size="small" onClick={run} disabled={running}>
                {running ? "Running…" : "Run query"}
              </Button>
            </div>
            <textarea
              ref={editorRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
              aria-label="SQL query"
              className="block h-36 w-full resize-y border-0 bg-canvas p-4 font-mono text-[12px] leading-relaxed text-primary outline-none"
            />
          </Surface>
          {error ? (
            <div className="border border-unavailable/40 bg-unavailable/10 p-3 font-mono text-[11.5px] text-unavailable">
              {error}
            </div>
          ) : rows.length || columns ? (
            <ResultTable rows={rows} columns={columns} />
          ) : (
            <EmptyState
              title="Run a query"
              detail="Results stay in this browser session and are not written to dsui."
            />
          )}
          <section className="grid gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[12px] font-semibold text-primary">
                Running queries
              </h2>
              <span className="font-mono text-[10px] text-muted">
                live · 3s
              </span>
            </div>
            {liveQueries.error ? (
              <div className="border border-unavailable/40 bg-unavailable/10 p-3 font-mono text-[11.5px] text-unavailable">
                {liveQueries.error}
              </div>
            ) : (liveQueries.data as unknown[][])?.length ? (
              <ResultTable
                rows={liveQueries.data as unknown[][]}
                columns={liveQueries.columns}
              />
            ) : (
              <p className="font-mono text-[11px] text-muted">
                No queries running.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes?: number) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

function S3Browser({ service }: { service: Service }) {
  type FileItem = {
    key: string;
    name: string;
    size?: number;
    updatedAt?: string;
  };
  const [path, setPath] = useState<{ bucket?: string; prefix: string }>({
    prefix: "",
  });
  const [items, setItems] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<{
    key: string;
    text?: string;
    meta?: Record<string, unknown>;
  }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const isRoot = !path.bucket;

  function list(bucket?: string, prefix = "", replace = true) {
    setLoading(true);
    setError(undefined);
    const token = replace ? undefined : cursor;
    runOperation(
      service.id,
      bucket ? "objects" : "buckets",
      bucket
        ? {
            bucket,
            prefix,
            delimiter: "/",
            ...(token ? { cursor: token } : {}),
          }
        : {},
    )
      .then((res) => {
        const incomingFolders = bucket ? ((res.folders as string[]) ?? []) : [];
        const incoming = bucket
          ? ((res.data as FileItem[]) ?? [])
          : (res.data as Array<{ name: string; createdAt?: string }>).map(
              (b) => ({ key: b.name, name: b.name, updatedAt: b.createdAt }),
            );
        if (bucket) {
          setFolders(incomingFolders);
          setItems((prev) => (replace ? incoming : [...prev, ...incoming]));
        } else {
          setItems(incoming);
          setFolders([]);
        }
        setCursor(res.nextCursor);
        if (replace) {
          setSelected(new Set());
          setPreview(undefined);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only initial load
  useEffect(() => {
    list();
  }, []);

  function openBucket(name: string) {
    setPath({ bucket: name, prefix: "" });
    list(name, "");
  }
  function openFolder(folder: string) {
    if (!path.bucket) return;
    const prefix = path.prefix + folder;
    setPath({ bucket: path.bucket, prefix });
    list(path.bucket, prefix);
  }
  function goTo(level: number) {
    if (level === 0) {
      setPath({ prefix: "" });
      list();
      return;
    }
    if (!path.bucket) return;
    const parts = path.prefix
      .split("/")
      .filter(Boolean)
      .slice(0, level - 1);
    const prefix = parts.join("/") + (parts.length ? "/" : "");
    setPath({ bucket: path.bucket, prefix });
    list(path.bucket, prefix);
  }
  const crumbs = path.bucket
    ? [path.bucket, ...path.prefix.split("/").filter(Boolean)]
    : [];

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  async function refresh() {
    await list(path.bucket, path.prefix);
  }
  async function removeSelected() {
    if (!path.bucket || selected.size === 0) return;
    setLoading(true);
    try {
      await runOperation(service.id, "object-delete", {
        bucket: path.bucket,
        keys: [...selected],
      });
      setSelected(new Set());
      await list(path.bucket, path.prefix);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  }
  async function openPreview(key: string) {
    if (!path.bucket) return;
    try {
      const res = await runOperation(service.id, "object-get", {
        bucket: path.bucket,
        key,
        previewBytes: 5 * 1024 * 1024,
      });
      const meta = res.data as Record<string, unknown>;
      const base64 = meta.preview as string | undefined;
      setPreview({
        key,
        text: base64 ? atob(base64) : undefined,
        meta,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    }
  }
  async function downloadSelected() {
    if (!path.bucket || selected.size !== 1) return;
    const key = [...selected][0];
    try {
      const res = await runOperation(service.id, "object-get", {
        bucket: path.bucket,
        key,
        previewBytes: 5 * 1024 * 1024,
      });
      const meta = res.data as Record<string, unknown>;
      const base64 = meta.preview as string | undefined;
      if (base64) {
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], {
          type: String(meta.contentType ?? "application/octet-stream"),
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = key.split("/").pop() ?? "download";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }
  async function uploadFile(file: File) {
    if (!path.bucket) return;
    const key = path.prefix + file.name;
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 4096)
      binary += String.fromCharCode(...bytes.subarray(i, i + 4096));
    const base64 = btoa(binary);
    setLoading(true);
    try {
      await runOperation(service.id, "object-put", {
        bucket: path.bucket,
        key,
        body: base64,
        contentType: file.type || "application/octet-stream",
      });
      await list(path.bucket, path.prefix);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div>
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <Link
            to="/"
            className="font-mono text-[10.5px] text-muted no-underline hover:text-primary"
          >
            ← All services
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ServiceMark
              adapter={service.adapter}
              logo={service.logo}
              size={18}
            />
            <b className="text-[12.5px] font-medium text-primary">
              {service.name}
            </b>
            <Status state={service.health} label={service.health} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2">
          <Button
            size="small"
            variant="secondary"
            onClick={refresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => setSelected(new Set(items.map((i) => i.key)))}
            disabled={isRoot || items.length === 0}
          >
            Select all
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => fileInput.current?.click()}
            disabled={isRoot}
          >
            Upload
          </Button>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
              e.target.value = "";
            }}
          />
          <Button
            size="small"
            variant="secondary"
            onClick={downloadSelected}
            disabled={selected.size !== 1}
          >
            Download
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={removeSelected}
            disabled={selected.size === 0}
          >
            Delete{selected.size ? ` (${selected.size})` : ""}
          </Button>
          <span className="ml-auto font-mono text-[10.5px] text-muted">
            {isRoot ? "Buckets" : `${items.length} objects`}
          </span>
        </div>
        {!isRoot && (
          <div className="flex items-center gap-1 border-b border-border px-5 py-2 font-mono text-[11px]">
            <button
              type="button"
              className="text-muted hover:text-primary"
              onClick={() => goTo(0)}
            >
              Buckets
            </button>
            {crumbs.map((c, i) => (
              <span key={c} className="flex items-center gap-1">
                <span className="text-border">/</span>
                <button
                  type="button"
                  className={
                    i === crumbs.length - 1
                      ? "text-primary"
                      : "text-muted hover:text-primary"
                  }
                  onClick={() => goTo(i + 1)}
                >
                  {c}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div
        className={cn(
          "grid min-h-0 flex-1",
          preview ? "grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1",
        )}
      >
        <div className="min-h-0 overflow-auto">
          {error ? (
            <div className="m-5 border border-unavailable/40 bg-unavailable/10 p-3 font-mono text-[11.5px] text-unavailable">
              {error}
            </div>
          ) : loading ? (
            <div className="p-5 font-mono text-[11px] text-muted">Loading…</div>
          ) : (
            <table className="w-full border-collapse font-mono text-[11.5px]">
              <tbody>
                {folders.map((folder) => (
                  <tr
                    key={`f:${folder}`}
                    onClick={() => openFolder(folder)}
                    className="cursor-pointer border-b border-border/60 hover:bg-surface-hover/60"
                  >
                    <td className="px-4 py-2 text-secondary">
                      <Icon name="folder" size={13} /> {folder}
                    </td>
                    <td className="px-4 py-2 text-muted">folder</td>
                    <td />
                  </tr>
                ))}
                {items.map((item) => (
                  <tr
                    key={item.key}
                    onClick={() => toggle(item.key)}
                    className={cn(
                      "cursor-pointer border-b border-border/60 hover:bg-surface-hover/60",
                      selected.has(item.key) && "bg-surface-hover/70",
                    )}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(item.key)}
                        onChange={() => toggle(item.key)}
                        onClick={(e) => e.stopPropagation()}
                        className="mr-2 align-middle"
                      />
                      {isRoot ? (
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openBucket(item.name);
                          }}
                        >
                          {item.name}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-secondary hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPreview(item.key);
                          }}
                        >
                          {item.name}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {isRoot || item.size == null
                        ? "—"
                        : formatBytes(item.size)}
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {item.updatedAt
                        ? new Date(item.updatedAt).toLocaleString()
                        : ""}
                    </td>
                  </tr>
                ))}
                {!loading && folders.length === 0 && items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center font-mono text-[11px] text-muted"
                    >
                      {isRoot ? "No buckets." : "Empty folder."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
          {!isRoot && cursor ? (
            <div className="p-4 text-center">
              <Button
                size="small"
                variant="secondary"
                onClick={() => list(path.bucket, path.prefix, false)}
                disabled={loading}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </div>
        {preview && (
          <aside className="overflow-auto border-l border-border bg-canvas p-4">
            <h3 className="text-[12px] font-semibold text-primary">Preview</h3>
            <p className="mt-1 break-all font-mono text-[10.5px] text-muted">
              {preview.key}
            </p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[10.5px]">
              {preview.meta &&
                Object.entries(preview.meta).map(([k, v]) => (
                  <Fragment key={k}>
                    <dt className="text-muted">{k}</dt>
                    <dd className="truncate text-secondary">
                      {String(v ?? "")}
                    </dd>
                  </Fragment>
                ))}
            </dl>
            <pre className="mt-3 max-h-[55vh] overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-secondary">
              {preview.text ?? "(binary or empty)"}
            </pre>
          </aside>
        )}
      </div>
    </div>
  );
}

function KafkaBrowser({ service }: { service: Service }) {
  type Message = {
    partition: number;
    offset: string | number;
    timestamp?: number;
    key?: string;
    value?: string;
  };
  const [topics, setTopics] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [fromBeginning, setFromBeginning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const kpis = usePolling(service.id, "metrics", 5000);

  useEffect(() => {
    setLoading(true);
    runOperation(service.id, "topics", { limit: 100 })
      .then((res) => {
        const names = ((res.data as Array<{ name: string }>) ?? []).map(
          (t) => t.name,
        );
        setTopics(names);
        setSelected((prev) => prev ?? names[0]);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load topics"),
      )
      .finally(() => setLoading(false));
  }, [service.id]);

  useEffect(() => {
    if (!selected || paused) return;
    let active = true;
    const load = () =>
      runOperation(service.id, "messages", {
        topic: selected,
        limit: 50,
        fromBeginning,
      })
        .then((res) => {
          if (!active) return;
          const incoming = (res.data as Message[]) ?? [];
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => `${m.partition}:${m.offset}`));
            const fresh = incoming.filter(
              (m) => !seen.has(`${m.partition}:${m.offset}`),
            );
            return [...fresh, ...prev].slice(0, 300);
          });
        })
        .catch(
          (e) =>
            active &&
            setError(
              e instanceof Error ? e.message : "Failed to load messages",
            ),
        );
    load();
    const timer = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selected, paused, fromBeginning, service.id]);

  return (
    <div className="grid flex-1 grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex h-[calc(100vh-3rem)] flex-col border-r border-border bg-canvas">
        <div className="border-b border-border px-3 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            Topics
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 py-2 font-mono text-[11.5px]">
          {loading ? (
            <p className="px-2 py-3 text-[11px] text-muted">Loading…</p>
          ) : (
            topics.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setSelected(name);
                  setMessages([]);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left",
                  selected === name
                    ? "bg-surface-hover text-primary"
                    : "text-secondary hover:bg-surface-hover hover:text-primary",
                )}
              >
                <Icon name="folder" size={13} />{" "}
                <span className="truncate">{name}</span>
              </button>
            ))
          )}
          {!loading && topics.length === 0 ? (
            <p className="px-2 py-3 text-[11px] text-muted">No topics.</p>
          ) : null}
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <Link
            to="/"
            className="font-mono text-[10.5px] text-muted no-underline hover:text-primary"
          >
            ← All services
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ServiceMark
              adapter={service.adapter}
              logo={service.logo}
              size={18}
            />
            <b className="text-[12.5px] font-medium text-primary">
              {service.name}
            </b>
            <Status state={service.health} label={service.health} />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-5">
          <section className="grid grid-cols-3 gap-3">
            {kpis.error ? (
              <span className="col-span-full font-mono text-[11px] text-unavailable">
                {kpis.error}
              </span>
            ) : kpis.data ? (
              (kpis.data as Array<{ label: string; value: unknown }>).map(
                (m) => (
                  <Surface key={m.label} className="grid gap-1 p-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      {m.label}
                    </span>
                    <span className="text-[20px] font-semibold text-primary">
                      {String(m.value)}
                    </span>
                  </Surface>
                ),
              )
            ) : (
              <span className="col-span-full font-mono text-[11px] text-muted">
                Loading metrics…
              </span>
            )}
          </section>
          <div className="flex items-center gap-3">
            <h2 className="text-[12px] font-semibold text-primary">
              {selected ?? "Select a topic"}
            </h2>
            <label className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted">
              <input
                type="checkbox"
                checked={fromBeginning}
                onChange={(e) => {
                  setFromBeginning(e.target.checked);
                  setMessages([]);
                }}
              />
              from beginning
            </label>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? "Resume" : "Pause"}
            </Button>
            <span className="ml-auto font-mono text-[10px] text-muted">
              live · 3s
            </span>
          </div>
          <div className="min-h-0 flex-1">
            {error ? (
              <div className="border border-unavailable/40 bg-unavailable/10 p-3 font-mono text-[11.5px] text-unavailable">
                {error}
              </div>
            ) : messages.length ? (
              <Surface className="overflow-hidden">
                <div className="max-h-[55vh] overflow-auto">
                  <table className="w-full border-collapse font-mono text-[11px]">
                    <thead className="sticky top-0 bg-canvas">
                      <tr className="border-b border-border text-left text-muted">
                        <th className="px-3 py-1.5">Partition</th>
                        <th className="px-3 py-1.5">Offset</th>
                        <th className="px-3 py-1.5">Timestamp</th>
                        <th className="px-3 py-1.5">Key</th>
                        <th className="px-3 py-1.5">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messages.map((m) => (
                        <tr
                          key={`${m.partition}:${m.offset}`}
                          className="border-b border-border/60 align-top hover:bg-surface-hover/60"
                        >
                          <td className="px-3 py-1.5 text-secondary">
                            {m.partition}
                          </td>
                          <td className="px-3 py-1.5 text-secondary">
                            {String(m.offset)}
                          </td>
                          <td className="px-3 py-1.5 text-muted">
                            {m.timestamp
                              ? new Date(
                                  Number(m.timestamp),
                                ).toLocaleTimeString()
                              : ""}
                          </td>
                          <td className="max-w-[200px] truncate px-3 py-1.5 text-secondary">
                            {m.key ?? "—"}
                          </td>
                          <td className="max-w-[420px] truncate whitespace-pre px-3 py-1.5 text-secondary">
                            {m.value ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Surface>
            ) : (
              <p className="font-mono text-[11px] text-muted">
                Waiting for messages…
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function JobBrowser({
  service,
  view,
  views,
}: {
  service: Service;
  view: ServiceViewDefinition;
  views: ServiceViewDefinition[];
}) {
  const listCapability = view.capability;
  const detailCapability = view.detail;
  const idField = view.idField ?? "id";
  const detailView = views.find((v) => v.id === detailCapability);
  const detailColumns = detailView?.columns ?? [];
  const metricsView =
    views.find(
      (v) => v.capability === "metrics" || v.capability === "overview",
    ) ?? views.find((v) => v.kind === "service-info");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<string>();
  const [detail, setDetail] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const kpis = usePolling(service.id, metricsView?.capability ?? "", 5000);

  useEffect(() => {
    let active = true;
    const load = () =>
      runOperation(service.id, listCapability, { limit: 100 })
        .then((res) => {
          if (!active) return;
          const items = (res.data as Record<string, unknown>[]) ?? [];
          setRows(items);
          setSelected((prev) => prev ?? String(items[0]?.[idField] ?? ""));
        })
        .catch(
          (e) =>
            active &&
            setError(
              e instanceof Error
                ? e.message
                : `Failed to load ${view.title.toLowerCase()}`,
            ),
        );
    setLoading(true);
    load().finally(() => active && setLoading(false));
    const interval = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [service.id, listCapability, idField, view.title]);

  useEffect(() => {
    if (!selected || !detailCapability) return;
    let active = true;
    const load = () =>
      runOperation(service.id, detailCapability, { [idField]: selected })
        .then((res) => {
          if (active) setDetail((res.data as Record<string, unknown>[]) ?? []);
        })
        .catch(
          (e) =>
            active &&
            setError(e instanceof Error ? e.message : "Failed to load details"),
        );
    load();
    const interval = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selected, detailCapability, idField, service.id]);

  const selectedRow = rows.find((row) => String(row[idField]) === selected);
  const statusField = ["state", "status", "completed"].find(
    (field) => selectedRow && field in selectedRow,
  );
  const statusValue = statusField
    ? String(selectedRow?.[statusField])
    : undefined;

  return (
    <div className="grid flex-1 grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex h-[calc(100vh-3rem)] flex-col border-r border-border bg-canvas">
        <div className="border-b border-border px-3 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {view.title}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 py-2 font-mono text-[11.5px]">
          {loading ? (
            <p className="px-2 py-3 text-[11px] text-muted">Loading…</p>
          ) : (
            rows.map((row) => {
              const id = String(row[idField]);
              const label = (row.name as string) ?? (row.title as string) ?? id;
              const rowStatus = ["state", "status", "completed"].find(
                (f) => f in row,
              );
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left",
                    selected === id
                      ? "bg-surface-hover text-primary"
                      : "text-secondary hover:bg-surface-hover hover:text-primary",
                  )}
                >
                  <span className="truncate">{String(label)}</span>
                  {rowStatus ? (
                    <span className="text-[10px] text-muted">
                      {String(row[rowStatus])}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
          {!loading && rows.length === 0 ? (
            <p className="px-2 py-3 text-[11px] text-muted">
              No {view.title.toLowerCase()}.
            </p>
          ) : null}
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <Link
            to="/"
            className="font-mono text-[10.5px] text-muted no-underline hover:text-primary"
          >
            ← All services
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ServiceMark
              adapter={service.adapter}
              logo={service.logo}
              size={18}
            />
            <b className="text-[12.5px] font-medium text-primary">
              {service.name}
            </b>
            <Status state={service.health} label={service.health} />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-5">
          <section className="grid grid-cols-3 gap-3">
            {metricsView && kpis.error ? (
              <span className="col-span-full font-mono text-[11px] text-unavailable">
                {kpis.error}
              </span>
            ) : metricsView && kpis.data ? (
              (kpis.data as Array<{ label: string; value: unknown }>).map(
                (m) => (
                  <Surface key={m.label} className="grid gap-1 p-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      {m.label}
                    </span>
                    <span className="text-[20px] font-semibold text-primary">
                      {String(m.value)}
                    </span>
                  </Surface>
                ),
              )
            ) : metricsView ? (
              <span className="col-span-full font-mono text-[11px] text-muted">
                Loading metrics…
              </span>
            ) : null}
          </section>
          <div className="flex items-center gap-3">
            <h2 className="text-[12px] font-semibold text-primary">
              {selectedRow
                ? ((selectedRow.name as string) ??
                  (selectedRow.title as string) ??
                  selected)
                : `Select ${view.title.toLowerCase().replace(/s$/, "")}`}
            </h2>
            {statusValue ? (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]",
                  /running|active|succeeded|finished|healthy|completed/i.test(
                    statusValue,
                  )
                    ? "bg-[var(--color-accent)]/15 text-accent"
                    : /fail|error|cancel|unavailable|dead/i.test(statusValue)
                      ? "bg-unavailable/15 text-unavailable"
                      : "bg-surface-hover text-secondary",
                )}
              >
                {statusValue}
              </span>
            ) : null}
            <span className="ml-auto font-mono text-[10px] text-muted">
              live · 3s
            </span>
          </div>
          <div className="min-h-0 flex-1">
            {error ? (
              <div className="border border-unavailable/40 bg-unavailable/10 p-3 font-mono text-[11.5px] text-unavailable">
                {error}
              </div>
            ) : detail.length ? (
              <ResultTable
                columns={detailColumns.map((c) => c.label)}
                rows={detail.map((item) =>
                  detailColumns.map((c) => item[c.id]),
                )}
              />
            ) : (
              <p className="font-mono text-[11px] text-muted">
                Waiting for details…
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid place-items-center gap-1.5 border border-dashed border-border bg-surface/50 px-6 py-12 text-center">
      <span className="text-muted">
        <Icon name="database" size={24} />
      </span>
      <h2 className="m-0 text-[13.5px] font-medium text-primary">{title}</h2>
      <p className="m-0 max-w-md text-[11.5px] text-secondary">{detail}</p>
    </div>
  );
}
function UnavailableState({ detail }: { detail: string }) {
  return (
    <div
      className="grid place-items-center gap-2 border border-unavailable/40 bg-unavailable/[0.06] px-6 py-12 text-center"
      role="alert"
    >
      <Status state="unavailable" label="API unavailable" />
      <h2 className="m-0 text-[14px] font-semibold text-primary">
        dsui could not load this data
      </h2>
      <p className="m-0 max-w-md break-words font-mono text-[11px] text-secondary">
        {detail}
      </p>
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

const authCardInput =
  "grid gap-4 border-t border-dashed border-border px-5 py-4";

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
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Wordmark className="justify-center" />
        <Surface>
          <div className="grid gap-1.5 p-5">
            <p className="m-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Data Stack UI
            </p>
            <h1 className="m-0 text-[16px] font-semibold text-primary">
              {title}
            </h1>
            <p className="m-0 text-[12px] text-secondary">{copy}</p>
          </div>
          {children}
        </Surface>
      </div>
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
      <form className={authCardInput} onSubmit={submit}>
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
      <p className="border-t border-dashed border-border px-5 py-3 text-center font-mono text-[10.5px] text-muted">
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
      <form className={authCardInput} onSubmit={submit}>
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
