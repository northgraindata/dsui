import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import {
  fleetSchema,
  incidentDetailSchema,
  incidentListSchema,
  suppressionListSchema,
} from "../contract";
import { React } from "../react";
import { styles } from "../styles";
import { dateTime, duration, pagePath } from "./format";
import { useAction, useNow, useResource } from "./hooks";
import { SuppressionForm, SuppressionList } from "./maintenance";
import {
  ActivityList,
  Empty,
  Notice,
  PageLink,
  Pill,
  Section,
  Tile,
} from "./parts";

type Scope = "active" | "resolved" | "all";

const scopeLabel: Record<Scope, string> = {
  active: "Active",
  resolved: "Resolved",
  all: "All",
};

const statusText = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
} as const;

export function IncidentsPage({ client }: ComponentProps) {
  const { useState } = React;
  const [scope, setScope] = useState<Scope>("active");
  const list = useResource(
    client,
    "incidents",
    { status: scope },
    incidentListSchema,
  );
  const schedule = useResource(
    client,
    "suppressions",
    {},
    suppressionListSchema,
  );
  const fleet = useResource(client, "service-health", {}, fleetSchema);
  const now = useNow();
  const data = list.data;

  return (
    <div className="h-page">
      <style>{styles}</style>
      <div className="h-tiles">
        <Tile
          label="Active"
          value={data?.active ?? "—"}
          status={data && data.active > 0 ? "unavailable" : undefined}
        />
        <Tile
          label="Resolved, 30 days"
          value={data?.resolvedLast30Days ?? "—"}
        />
        <Tile
          label="Mean time to resolve"
          value={
            data?.meanTimeToResolveMs == null
              ? "—"
              : duration(data.meanTimeToResolveMs)
          }
          detail="Resolved in the last 30 days"
        />
      </div>

      <Section
        title="Incidents"
        detail="Opened automatically when a service stays unhealthy, and resolved when it recovers."
        actions={
          <fieldset className="h-tabs" aria-label="Incident filter">
            {(["active", "resolved", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={scope === value}
                onClick={() => setScope(value)}
              >
                {scopeLabel[value]}
              </button>
            ))}
          </fieldset>
        }
      >
        {list.error && <Notice tone="error">{list.error}</Notice>}
        {!data && !list.error && <Notice>Loading incidents…</Notice>}
        {data && data.items.length === 0 && (
          <Empty>
            {scope === "active"
              ? "No active incidents. All monitored services are in good shape."
              : "No incidents to show."}
          </Empty>
        )}
        {data && data.items.length > 0 && (
          <div className="h-table-wrap">
            <table className="h-table">
              <thead>
                <tr>
                  <th scope="col">Incident</th>
                  <th scope="col">Service</th>
                  <th scope="col">Status</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Opened</th>
                  <th scope="col" className="h-right">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((incident) => (
                  <tr key={incident.id}>
                    <td className="h-clip" title={incident.summary}>
                      <PageLink
                        client={client}
                        to={pagePath.incident(incident.id)}
                      >
                        <strong>{incident.summary}</strong>
                      </PageLink>
                    </td>
                    <td>
                      <PageLink
                        client={client}
                        to={pagePath.service(incident.serviceId)}
                      >
                        {incident.serviceName}
                      </PageLink>
                    </td>
                    <td>{statusText[incident.status]}</td>
                    <td>
                      <Pill
                        status={incident.severity}
                        label={
                          incident.severity === "unavailable"
                            ? "Unavailable"
                            : "Degraded"
                        }
                      />
                    </td>
                    <td className="h-num">{dateTime(incident.openedAt)}</td>
                    <td className="h-num h-right">
                      {duration(
                        (incident.resolvedAt ?? now) - incident.openedAt,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Maintenance and silences"
        detail="Maintenance is excluded from uptime. A silence mutes incidents and signals but still counts as downtime."
      >
        {schedule.error && <Notice tone="error">{schedule.error}</Notice>}
        <SuppressionList
          client={client}
          items={schedule.data?.items ?? []}
          now={now}
          onChange={schedule.reload}
          showService
        />
        <SuppressionForm
          client={client}
          services={fleet.data?.items.map((item) => ({
            id: item.id,
            name: item.name,
          }))}
          onCreated={schedule.reload}
        />
      </Section>
    </div>
  );
}

export function IncidentPage({ client, node }: ComponentProps) {
  const { useState } = React;
  const props = (node.kind === "custom" ? node.props.props : undefined) as
    | { incidentId?: string }
    | undefined;
  const incidentId = props?.incidentId ?? "";
  const detail = useResource(
    client,
    "incident-detail",
    { incidentId },
    incidentDetailSchema,
  );
  const now = useNow();
  const act = useAction(client, detail.reload);
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const data = detail.data;
  const incident = data?.incident;

  return (
    <div className="h-page">
      <style>{styles}</style>
      <p className="h-breadcrumb">
        <PageLink client={client} to={pagePath.incidents}>
          Incidents
        </PageLink>
        {" / "}
        {incident?.serviceName ?? incidentId}
      </p>
      {detail.error && !data && <Notice tone="error">{detail.error}</Notice>}
      {!data && !detail.error && <Notice>Loading incident…</Notice>}
      {data && incident && (
        <>
          <div className="h-card">
            <div className="h-header">
              <div className="h-header-title">
                <div>
                  <h1>{incident.summary}</h1>
                  <p>
                    <PageLink
                      client={client}
                      to={pagePath.service(incident.serviceId)}
                    >
                      {incident.serviceName}
                    </PageLink>
                    {incident.adapter ? ` · ${incident.adapter}` : ""}
                  </p>
                </div>
              </div>
              <div className="h-section-actions">
                <Pill
                  status={incident.severity}
                  label={
                    incident.severity === "unavailable"
                      ? "Unavailable"
                      : "Degraded"
                  }
                />
                <span>{statusText[incident.status]}</span>
              </div>
            </div>
            <div className="h-facts">
              <span>
                Opened <b>{dateTime(incident.openedAt)}</b>
              </span>
              <span>
                {incident.resolvedAt === null ? "Open for " : "Lasted "}
                <b>
                  {duration((incident.resolvedAt ?? now) - incident.openedAt)}
                </b>
              </span>
              {incident.acknowledgedBy && (
                <span>
                  Acknowledged by <b>{incident.acknowledgedBy}</b>
                </span>
              )}
              {incident.resolvedAt !== null && (
                <span>
                  Resolved{" "}
                  <b>
                    {incident.resolvedBy
                      ? `by ${incident.resolvedBy}`
                      : "automatically on recovery"}
                  </b>
                </span>
              )}
              <span>
                Service now <b>{data.serviceHealth}</b>
              </span>
            </div>
            {incident.resolutionNote && <p>{incident.resolutionNote}</p>}
          </div>

          {act.error && <Notice tone="error">{act.error}</Notice>}

          {incident.status !== "resolved" && (
            <Section title="Respond">
              <div className="h-form">
                {incident.status === "open" && (
                  <button
                    type="button"
                    className="h-button"
                    data-variant="primary"
                    disabled={act.pending}
                    onClick={() =>
                      void act.run("acknowledge-incident", { incidentId })
                    }
                  >
                    Acknowledge
                  </button>
                )}
                <label className="h-field h-grow">
                  Resolution note
                  <input
                    value={resolution}
                    maxLength={2000}
                    placeholder="Optional. Resolving a failing service keeps it quiet until it recovers."
                    onChange={(event) => setResolution(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="h-button"
                  disabled={act.pending}
                  onClick={() =>
                    void act
                      .run("resolve-incident", { incidentId, note: resolution })
                      .then((ok) => ok && setResolution(""))
                  }
                >
                  Resolve
                </button>
              </div>
            </Section>
          )}

          {data.around.length > 0 && (
            <Section
              title="Around this time"
              detail="Signals from this service shortly before and after the incident opened. They may point to a cause."
            >
              <ActivityList items={data.around} />
            </Section>
          )}

          <Section title="Timeline">
            <div className="h-card">
              <ol className="h-timeline">
                {data.events.map((event) => (
                  <li key={event.id} data-kind={event.kind}>
                    <strong>
                      {eventTitle[event.kind]}
                      {event.actor ? ` by ${event.actor}` : ""}
                    </strong>
                    {event.message && <span>{event.message}</span>}
                    <time dateTime={new Date(event.time).toISOString()}>
                      {dateTime(event.time)}
                    </time>
                  </li>
                ))}
              </ol>
            </div>
            <form
              className="h-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!note.trim()) return;
                void act
                  .run("note-incident", { incidentId, message: note.trim() })
                  .then((ok) => ok && setNote(""));
              }}
            >
              <label className="h-field h-grow">
                Add a note
                <input
                  value={note}
                  maxLength={2000}
                  placeholder="What did you find or change?"
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <button
                type="submit"
                className="h-button"
                disabled={act.pending || !note.trim()}
              >
                Add note
              </button>
            </form>
          </Section>
        </>
      )}
    </div>
  );
}

const eventTitle = {
  opened: "Incident opened",
  escalated: "Escalated",
  deescalated: "Improved",
  acknowledged: "Acknowledged",
  note: "Note added",
  resolved: "Resolved",
  reopened: "Reopened",
} as const;
