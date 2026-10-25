import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import { createOptionSelect } from "@northgraindata/dsui-ui/option-select-factory";
import type { Health } from "../context";
import { type FleetItem, fleetSchema, incidentListSchema } from "../contract";
import { React } from "../react";
import { styles } from "../styles";
import {
  ago,
  attentionOrder,
  duration,
  millis,
  pagePath,
  percent,
  statusLabel,
} from "./format";
import { useAction, useNow, useResource } from "./hooks";
import { Empty, Notice, PageLink, Pill, Section, Strip, Tile } from "./parts";
import { Reliability } from "./reliability";

const OptionSelect = createOptionSelect(() => React);

type Filter = Health | "all" | "attention";

export function OverviewPage({ client }: ComponentProps) {
  const { useMemo, useState } = React;
  const fleet = useResource(client, "service-health", {}, fleetSchema);
  const active = useResource(
    client,
    "incidents",
    { status: "active" },
    incidentListSchema,
  );
  const check = useAction(client, () => {
    fleet.reload();
    active.reload();
  });
  const now = useNow();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (fleet.data?.items ?? [])
      .filter((item) => {
        if (filter === "attention" && item.health === "healthy") return false;
        if (
          filter !== "all" &&
          filter !== "attention" &&
          item.health !== filter
        )
          return false;
        return (
          !query ||
          `${item.name} ${item.adapter} ${item.detail ?? ""}`
            .toLocaleLowerCase()
            .includes(query)
        );
      })
      .sort(
        (a, b) =>
          attentionOrder[a.health] - attentionOrder[b.health] ||
          a.name.localeCompare(b.name),
      );
  }, [fleet.data, filter, search]);

  const data = fleet.data;
  const incidents = active.data?.items ?? [];

  return (
    <div className="h-page">
      <style>{styles}</style>

      {incidents.length > 0 && (
        <div className="h-banner" role="status">
          <span>
            <strong>
              {incidents.length}{" "}
              {incidents.length === 1 ? "active incident" : "active incidents"}
            </strong>
            {": "}
            {incidents
              .slice(0, 3)
              .map((incident) => incident.serviceName)
              .join(", ")}
            {incidents.length > 3 ? ` and ${incidents.length - 3} more` : ""}
          </span>
          <PageLink client={client} to={pagePath.incidents}>
            View incidents
          </PageLink>
        </div>
      )}

      <div className="h-tiles" aria-busy={!data}>
        <Tile
          label="Services"
          value={
            data ? (
              data.items.length
            ) : (
              <span
                className="h-skeleton"
                style={{ width: 40, display: "inline-block" }}
              />
            )
          }
        />
        <Tile
          label="Healthy"
          value={data?.counts.healthy ?? "—"}
          status="healthy"
        />
        <Tile
          label="Degraded"
          value={data?.counts.warning ?? "—"}
          status="warning"
        />
        <Tile
          label="Unavailable"
          value={data?.counts.unavailable ?? "—"}
          status="unavailable"
        />
        <Tile
          label="Uptime, 7 days"
          value={percent(data?.availability7d ?? null)}
          detail="Across all services"
        />
      </div>

      <Section
        title="Services"
        detail="Services needing attention appear first."
        actions={
          <>
            <label className="h-search">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search services"
                placeholder="Search services"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <OptionSelect
              ariaLabel="Filter by status"
              value={filter}
              onValueChange={(value) =>
                setFilter(
                  value === "attention" ||
                    value === "healthy" ||
                    value === "warning" ||
                    value === "unavailable" ||
                    value === "unknown"
                    ? value
                    : "all",
                )
              }
              options={[
                { value: "all", label: "All statuses", icon: <span>◉</span> },
                {
                  value: "attention",
                  label: "Needs attention",
                  icon: <span>!</span>,
                },
                ...(
                  ["healthy", "warning", "unavailable", "unknown"] as const
                ).map((status) => ({
                  value: status,
                  label: statusLabel[status],
                  icon: (
                    <span style={{ color: `var(--color-${status})` }}>●</span>
                  ),
                })),
              ]}
            />
            <button
              type="button"
              className="h-button"
              disabled={check.pending}
              onClick={() => void check.run("check-now", {})}
            >
              {check.pending ? "Checking…" : "Check now"}
            </button>
          </>
        }
      >
        {check.error && <Notice tone="error">{check.error}</Notice>}
        {fleet.error && (
          <Notice tone="error">
            {data ? `Refresh failed: ${fleet.error}` : fleet.error}
          </Notice>
        )}
        {!data && !fleet.error && <Notice>Loading services…</Notice>}
        {data && data.items.length === 0 && (
          <Empty>
            No services configured yet. Add one to see its health here.
          </Empty>
        )}
        {data && data.items.length > 0 && (
          <div className="h-table-wrap">
            <table className="h-table">
              <thead>
                <tr>
                  <th scope="col">Service</th>
                  <th scope="col">Status</th>
                  <th
                    scope="col"
                    className="h-right"
                    title="Share of checks in which the service was not unavailable"
                  >
                    Uptime 7d
                  </th>
                  <th
                    scope="col"
                    className="h-right"
                    title="Time for the adapter health check"
                  >
                    Response
                  </th>
                  <th
                    scope="col"
                    title="One bar per hour; grey means nothing was measured"
                  >
                    Last 7 days
                  </th>
                  <th scope="col">Checked</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <ServiceRow
                    key={item.id}
                    item={item}
                    client={client}
                    now={now}
                  />
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <Empty>No services match these filters.</Empty>
            )}
          </div>
        )}
        {data && data.items.length > 0 && (
          <p className="h-muted">
            Showing {rows.length} of {data.items.length} services. Results are
            recorded in the background; opening this page does not probe them.
          </p>
        )}
      </Section>

      <Reliability client={client} />
    </div>
  );
}

function ServiceRow({
  item,
  client,
  now,
}: {
  item: FleetItem;
  client: ComponentProps["client"];
  now: number;
}) {
  return (
    <tr>
      <td>
        <div className="h-service">
          {item.iconUrl && <img src={item.iconUrl} alt="" />}
          <PageLink client={client} to={pagePath.service(item.id)}>
            <strong>{item.name}</strong>
            <span>{item.adapter}</span>
          </PageLink>
        </div>
      </td>
      <td>
        <Pill status={item.maintenance ? "maintenance" : item.health} />
        <span className="h-since">
          {item.lastCheckedAt === null
            ? "Not checked yet"
            : item.since !== null
              ? `for ${duration(now - item.since)}`
              : ""}
          {item.incidentId ? " · incident open" : ""}
        </span>
      </td>
      <td className="h-num h-right">{percent(item.availability7d)}</td>
      <td className="h-num h-right">{millis(item.latencyMs)}</td>
      <td className="h-strip-cell">
        <Strip
          buckets={item.strip}
          unit="hour"
          label={`${item.name}, last seven days`}
        />
      </td>
      <td className="h-muted h-num" title={item.detail}>
        {ago(item.lastCheckedAt, now)}
      </td>
    </tr>
  );
}
