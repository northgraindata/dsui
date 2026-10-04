import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  executePluginResource,
  getAdapters,
  getPluginResources,
} from "../../api";
import { Icon } from "../../components/icon";
import { ServiceMark } from "../../components/service-mark";
import "./health-page.css";

type HealthStatus = "healthy" | "warning" | "unavailable" | "unknown";

type HealthRow = {
  id: string;
  name: string;
  adapter: string;
  health: HealthStatus;
  detail?: string;
  latencyMs?: number;
};

const statusOrder: Record<HealthStatus, number> = {
  unavailable: 0,
  warning: 1,
  unknown: 2,
  healthy: 3,
};

const statusLabel: Record<HealthStatus, string> = {
  healthy: "Healthy",
  warning: "Warning",
  unavailable: "Unavailable",
  unknown: "Unknown",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isHealthStatus(value: unknown): value is HealthStatus {
  return (
    value === "healthy" ||
    value === "warning" ||
    value === "unavailable" ||
    value === "unknown"
  );
}

function readHealthRows(value: unknown): HealthRow[] {
  if (!isRecord(value) || !Array.isArray(value.items))
    throw new Error("Health response is missing the service list.");
  return value.items.map((item: unknown) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.adapter !== "string" ||
      !isHealthStatus(item.health) ||
      (item.detail !== undefined && typeof item.detail !== "string") ||
      (item.latencyMs !== undefined &&
        (typeof item.latencyMs !== "number" ||
          !Number.isFinite(item.latencyMs)))
    )
      throw new Error("Health response contains an invalid service.");
    return {
      id: item.id,
      name: item.name,
      adapter: item.adapter,
      health: item.health,
      ...(item.detail !== undefined ? { detail: item.detail } : {}),
      ...(item.latencyMs !== undefined ? { latencyMs: item.latencyMs } : {}),
    };
  });
}

function useHealthData() {
  const [rows, setRows] = useState<HealthRow[]>();
  const [logos, setLogos] = useState<Record<string, string | undefined>>({});
  const [updatedAt, setUpdatedAt] = useState<Date>();
  const [intervalMs, setIntervalMs] = useState<number>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const refresh = useRef<() => void>(() => undefined);

  useEffect(() => {
    let active = true;
    let running = false;
    let timer: number | undefined;

    const load = () => {
      if (running) return;
      running = true;
      setLoading(true);

      void executePluginResource("health", "service-health", {})
        .then(readHealthRows)
        .then((result) => {
          if (!active) return;
          setRows(result);
          setUpdatedAt(new Date());
          setError(undefined);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setError(
            cause instanceof Error ? cause.message : "Could not check health.",
          );
        })
        .finally(() => {
          running = false;
          if (active) setLoading(false);
        });
    };

    refresh.current = load;
    void getPluginResources("health")
      .then((resources) => {
        if (!active) return;
        const policy = resources.find(
          (resource) => resource.id === "service-health",
        )?.refresh;
        if (policy?.kind !== "poll")
          throw new Error("Health refresh policy is unavailable.");
        setIntervalMs(policy.intervalMs);
        load();
        timer = window.setInterval(load, policy.intervalMs);
      })
      .catch((cause: unknown) => {
        if (active) {
          setLoading(false);
          setError(
            cause instanceof Error ? cause.message : "Could not load health.",
          );
        }
      });

    void getAdapters()
      .then((adapters) => {
        if (active)
          setLogos(
            Object.fromEntries(adapters.map(({ id, logo }) => [id, logo])),
          );
      })
      .catch(() => undefined);

    return () => {
      active = false;
      if (timer !== undefined) window.clearInterval(timer);
      refresh.current = () => undefined;
    };
  }, []);

  return { rows, logos, updatedAt, intervalMs, error, loading, refresh };
}

export function HealthPage() {
  const { rows, logos, updatedAt, intervalMs, error, loading, refresh } =
    useHealthData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<HealthStatus | "all">("all");

  const counts = useMemo(() => {
    const result: Record<HealthStatus, number> = {
      healthy: 0,
      warning: 0,
      unavailable: 0,
      unknown: 0,
    };
    for (const row of rows ?? []) result[row.health] += 1;
    return result;
  }, [rows]);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (rows ?? [])
      .filter(
        (row) =>
          (filter === "all" || row.health === filter) &&
          (!query ||
            `${row.name} ${row.adapter} ${row.detail ?? ""}`
              .toLocaleLowerCase()
              .includes(query)),
      )
      .sort(
        (left, right) =>
          statusOrder[left.health] - statusOrder[right.health] ||
          left.name.localeCompare(right.name),
      );
  }, [rows, filter, search]);

  return (
    <div className="health-page">
      <header className="health-page-heading">
        <div>
          <h1>Service health</h1>
          <p>Status and response time for your connected services.</p>
        </div>
        <div className="health-page-refresh">
          <span>
            {updatedAt
              ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Waiting for first check"}
            {intervalMs ? ` · Refreshes every ${intervalMs / 1000}s` : ""}
          </span>
          <button
            type="button"
            onClick={() => refresh.current()}
            disabled={loading || intervalMs === undefined}
            aria-label="Refresh service health"
            title="Refresh service health"
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </header>

      <div className="health-page-summary">
        <strong>
          {rows?.length ?? "—"} {rows?.length === 1 ? "service" : "services"}{" "}
          checked
        </strong>
        <span data-health="healthy">{counts.healthy} healthy</span>
        <span data-health="warning">{counts.warning} warning</span>
        <span data-health="unavailable">{counts.unavailable} unavailable</span>
        <span data-health="unknown">{counts.unknown} unknown</span>
      </div>

      <section className="health-page-list" aria-busy={loading && !rows}>
        <div className="health-page-list-heading">
          <div>
            <h2>Services</h2>
            <p>Services needing attention appear first.</p>
          </div>
          <div className="health-page-controls">
            <label className="health-page-search">
              <Icon name="search" size={16} />
              <span className="sr-only">Search services</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search services"
              />
            </label>
            <select
              aria-label="Filter by health status"
              value={filter}
              onChange={(event) =>
                setFilter(
                  isHealthStatus(event.target.value)
                    ? event.target.value
                    : "all",
                )
              }
            >
              <option value="all">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="unavailable">Unavailable</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="health-page-error" role="alert">
            {rows ? `Refresh failed: ${error}` : error}
          </p>
        )}
        {!rows && !error && (
          <p className="health-page-empty" role="status">
            Checking services…
          </p>
        )}
        {rows && rows.length === 0 && (
          <p className="health-page-empty">No services configured yet.</p>
        )}
        {rows && rows.length > 0 && (
          <div className="health-page-table-scroll">
            <table className="health-page-table">
              <thead>
                <tr>
                  <th scope="col">Service</th>
                  <th scope="col">Status</th>
                  <th scope="col" title="Time for the adapter health check">
                    Ping
                  </th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        to="/services/$serviceId"
                        params={{ serviceId: row.id }}
                        className="health-page-service"
                      >
                        <strong>{row.name}</strong>
                        <span>
                          <ServiceMark
                            adapter={row.adapter}
                            logo={logos[row.adapter]}
                            size={22}
                          />
                          {row.adapter}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span
                        className="health-page-status"
                        data-health={row.health}
                      >
                        <i aria-hidden="true" />
                        {statusLabel[row.health]}
                      </span>
                    </td>
                    <td className="health-page-ping">
                      {row.latencyMs === undefined
                        ? "—"
                        : `${row.latencyMs} ms`}
                    </td>
                    <td className="health-page-detail" title={row.detail}>
                      {row.detail ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && (
              <p className="health-page-empty">
                No services match these filters.
              </p>
            )}
          </div>
        )}
        {rows && rows.length > 0 && (
          <p className="health-page-footer">
            Showing {visible.length} of {rows.length} checked services
          </p>
        )}
      </section>
    </div>
  );
}
