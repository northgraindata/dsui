import { Link } from "@tanstack/react-router";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { getServices, type Service } from "../api";
import { SERVICE_CONNECTIONS_CHANGED } from "../service-events";
import { Icon } from "./icon";
import { NavigationMark } from "./navigation-mark";
import { ServiceMark } from "./service-mark";

const mobileQuery = "(max-width: 640px)";
function subscribeToViewport(callback: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useConnections(pathname: string, open: boolean) {
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Opening the list and navigation refresh connection changes made elsewhere.
  useEffect(() => {
    let active = true;
    let generation = 0;
    const isCurrent = (request: number) => active && request === generation;
    const load = async () => {
      const request = ++generation;
      try {
        const items = await getServices();
        if (!isCurrent(request)) return;
        setServices(
          [...items].sort(
            (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
          ),
        );
        setError(false);
      } catch {
        if (isCurrent(request)) setError(true);
      } finally {
        if (isCurrent(request)) setLoading(false);
      }
    };
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    void load();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener(SERVICE_CONNECTIONS_CHANGED, refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener(SERVICE_CONNECTIONS_CHANGED, refresh);
    };
  }, [pathname, open, attempt]);
  return {
    services,
    error,
    loading,
    retry: () => setAttempt((value) => value + 1),
  };
}

function ConnectedService({
  service,
  pathname,
}: {
  service: Service;
  pathname: string;
}) {
  return (
    <li>
      <Link
        to="/services/$serviceId"
        params={{ serviceId: service.id }}
        className="sidebar-connection"
        title={service.name}
        aria-current={
          pathname === `/services/${encodeURIComponent(service.id)}` ||
          pathname.startsWith(`/services/${encodeURIComponent(service.id)}/`)
            ? "page"
            : undefined
        }
      >
        <ServiceMark
          adapter={service.adapter}
          logo={service.logo}
          size={24}
          variant="bare"
        />
        <span className="sidebar-connection-name">{service.name}</span>
        <span
          className="health-dot"
          data-health={service.health}
          role="img"
          aria-label={`Status: ${service.health}`}
        />
      </Link>
    </li>
  );
}

export function SidebarConnections({
  pathname,
  collapsed,
  expandSidebar,
}: {
  pathname: string;
  collapsed: boolean;
  expandSidebar(): void;
}) {
  const [expanded, setExpanded] = useState(true);
  const mobile = useSyncExternalStore(
    subscribeToViewport,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
  const open = expanded && (mobile || !collapsed);
  const id = useId();
  const { services, error, loading, retry } = useConnections(pathname, open);
  return (
    <div className="sidebar-connections">
      <button
        type="button"
        className="app-nav-link sidebar-connections-toggle"
        aria-expanded={open}
        aria-controls={id}
        aria-label="Adapters"
        title="Adapters"
        onClick={() => {
          if (collapsed && !mobile) {
            expandSidebar();
            setExpanded(true);
          } else setExpanded((value) => !value);
        }}
      >
        <NavigationMark name="adapters" />
        <span className="sidebar-connections-label">Adapters</span>
        <span className="sidebar-connections-trailing" aria-hidden="true">
          {!loading && !error && (
            <span className="sidebar-connections-count">{services.length}</span>
          )}
          <Icon name="chevron-down" size={14} />
        </span>
      </button>
      <ul
        id={id}
        className="sidebar-connections-list"
        hidden={!open}
        aria-label="Connected adapters"
      >
        {loading && (
          <li className="sidebar-connections-message" role="status">
            Loading connections…
          </li>
        )}
        {error ? (
          <li className="sidebar-connections-message" role="status">
            Could not load connections.{" "}
            <button type="button" onClick={retry}>
              Retry
            </button>
          </li>
        ) : (
          services.map((service) => (
            <ConnectedService
              key={service.id}
              service={service}
              pathname={pathname}
            />
          ))
        )}
        {!loading && !error && services.length === 0 && (
          <li className="sidebar-connections-message">No connections yet</li>
        )}
        <li className="sidebar-connect-new">
          <Link
            to="/services"
            className="sidebar-connection"
            aria-current={
              pathname === "/services" ||
              pathname === "/services/new" ||
              pathname.startsWith("/adapters/")
                ? "page"
                : undefined
            }
          >
            <span className="sidebar-connect-new-mark">
              <Icon name="plus" size={15} />
            </span>
            <span>Connect new</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
