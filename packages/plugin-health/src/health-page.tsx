import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import { type FleetItem, fleetSchema } from "./contract";
import { HistoryStrip } from "./history-strip";
import { Select } from "./host-ui";
import { historyStyles, overviewStyles } from "./overview-styles";
import { React } from "./react";

type HealthStatus = "healthy" | "warning" | "unavailable" | "unknown";

type HealthRow = {
  id: string;
  name: string;
  adapter: string;
  iconUrl?: string;
  health: HealthStatus;
  strip: FleetItem["strip"];
  availability7d: number | null;
  detail?: string;
  latencyMs?: number;
  score?: number;
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

function isHealthStatus(value: unknown): value is HealthStatus {
  return (
    value === "healthy" ||
    value === "warning" ||
    value === "unavailable" ||
    value === "unknown"
  );
}

/** Rows from recorded results; reading them never probes a service. */
function readHealthRows(value: unknown): HealthRow[] {
  return fleetSchema.parse(value).items.map((item) => ({
    id: item.id,
    name: item.name,
    adapter: item.adapter,
    ...(item.iconUrl ? { iconUrl: item.iconUrl } : {}),
    health: item.health,
    strip: item.strip,
    availability7d: item.availability7d,
    ...(item.detail !== undefined ? { detail: item.detail } : {}),
    ...(item.latencyMs !== undefined
      ? { latencyMs: Math.round(item.latencyMs) }
      : {}),
    ...(item.score !== undefined ? { score: item.score } : {}),
  }));
}

function useHealthData(client: ComponentProps["client"]) {
  const { useState, useRef, useEffect } = React;
  const [rows, setRows] = useState<HealthRow[]>();
  const [updatedAt, setUpdatedAt] = useState<Date>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const refresh = useRef<() => void>(() => undefined);

  useEffect(() => {
    let active = true;
    let running = false;

    const load = () => {
      if (running) return;
      running = true;
      setLoading(true);

      void client
        .executeResource({ resourceId: "service-health", input: {} })
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

    // The refresh button asks for new checks; the scheduler limits how often
    // one service can be checked by hand, so this cannot hammer a system.
    refresh.current = () => {
      setLoading(true);
      void client
        .executeAction({ actionId: "check-now", input: {} })
        .then((result) => {
          if (active && result.status === "error")
            setError(result.message ?? "Could not check services.");
        })
        .catch((cause: unknown) => {
          if (active)
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not check services.",
            );
        })
        .finally(load);
    };
    load();
    const unsubscribe = client.watchResource?.(
      { resourceId: "service-health", input: {} },
      (value) => {
        if (!active) return;
        try {
          setRows(readHealthRows(value));
          setUpdatedAt(new Date());
          setError(undefined);
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : "Could not load health.",
          );
        }
      },
    );

    return () => {
      active = false;
      unsubscribe?.();
      refresh.current = () => undefined;
    };
  }, [client]);

  return { rows, updatedAt, error, loading, refresh };
}

export function HealthPage({ client }: ComponentProps) {
  const { useState, useMemo } = React;
  const { rows, updatedAt, error, loading, refresh } = useHealthData(client);
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
      <style>{overviewStyles + historyStyles}</style>

      <div className="health-page-summary">
        <strong>
          {rows?.length ?? "-"} {rows?.length === 1 ? "service" : "services"}{" "}
          checked
        </strong>
        <span data-health="healthy">{counts.healthy} healthy</span>
        <span data-health="warning">{counts.warning} warning</span>
        <span data-health="unavailable">{counts.unavailable} unavailable</span>
        <span data-health="unknown">{counts.unknown} unknown</span>
        <div className="health-page-refresh">
          <span>
            {updatedAt
              ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Waiting for first check"}
          </span>
          <button
            type="button"
            onClick={() => refresh.current()}
            disabled={loading}
            aria-label="Refresh service health"
            title="Refresh service health"
          >
            <span aria-hidden="true">↻</span>
          </button>
        </div>
      </div>

      <section className="health-page-list" aria-busy={loading && !rows}>
        <div className="health-page-list-heading">
          <div>
            <h2>Services</h2>
            <p>Services needing attention appear first.</p>
          </div>
          <div className="health-page-controls">
            <label className="health-page-search">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search services"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search services"
              />
            </label>
            <HealthFilter filter={filter} setFilter={setFilter} />
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
                    Response
                  </th>
                  <th
                    scope="col"
                    title="Infrastructure health score reported by the adapter"
                  >
                    Score
                  </th>
                  <th
                    scope="col"
                    title="One bar per hour; gaps mean no recorded checks"
                  >
                    Last week
                  </th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <a
                        href={`/services/${encodeURIComponent(row.id)}`}
                        className="health-page-service"
                      >
                        <strong>{row.name}</strong>
                        <span>
                          {row.iconUrl && (
                            <img
                              src={row.iconUrl}
                              alt=""
                              width={22}
                              height={22}
                              style={{ objectFit: "contain", flexShrink: 0 }}
                            />
                          )}
                          {row.adapter}
                        </span>
                      </a>
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
                        ? "-"
                        : `${row.latencyMs} ms`}
                    </td>
                    <td className="health-page-score">
                      {row.score === undefined
                        ? "-"
                        : `${Math.round(row.score)}/100`}
                    </td>
                    <td>
                      <HistoryStrip
                        buckets={row.strip}
                        availability={row.availability7d}
                      />
                    </td>
                    <td className="health-page-detail" title={row.detail}>
                      {row.detail ?? "-"}
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
            Showing {visible.length} of {rows.length} checked services. History
            records adapter checks in the background; grey bars have no
            measurement.
          </p>
        )}
      </section>
    </div>
  );
}

function HealthFilter({
  filter,
  setFilter,
}: {
  filter: HealthStatus | "all";
  setFilter: (value: HealthStatus | "all") => void;
}) {
  return (
    <Select
      ariaLabel="Filter by health status"
      value={filter}
      onValueChange={(value) =>
        setFilter(isHealthStatus(value) ? value : "all")
      }
      options={[
        { value: "all", label: "All statuses", icon: <span>◉</span> },
        {
          value: "healthy",
          label: "Healthy",
          icon: <span style={{ color: "var(--color-healthy)" }}>●</span>,
        },
        {
          value: "warning",
          label: "Warning",
          icon: <span style={{ color: "var(--color-warning)" }}>●</span>,
        },
        {
          value: "unavailable",
          label: "Unavailable",
          icon: <span style={{ color: "var(--color-unavailable)" }}>●</span>,
        },
        {
          value: "unknown",
          label: "Unknown",
          icon: <span style={{ color: "var(--color-unknown)" }}>●</span>,
        },
      ]}
    />
  );
}
