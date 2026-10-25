import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import { type ServiceDetail, serviceDetailSchema } from "../contract";
import { React } from "../react";
import { styles } from "../styles";
import {
  ago,
  dateTime,
  duration,
  millis,
  pagePath,
  percent,
  until,
} from "./format";
import { useAction, useNow, useResource } from "./hooks";
import { SuppressionForm, SuppressionList } from "./maintenance";
import {
  ActivityList,
  Empty,
  LatencyChart,
  Notice,
  PageLink,
  Pill,
  Section,
  Strip,
  Tile,
} from "./parts";

type Client = ComponentProps["client"];

export function ServicePage({ client, node }: ComponentProps) {
  const props = (node.kind === "custom" ? node.props.props : undefined) as
    | { serviceId?: string }
    | undefined;
  const serviceId = props?.serviceId ?? "";
  const detail = useResource(
    client,
    "service-detail",
    { serviceId },
    serviceDetailSchema,
  );
  const now = useNow();
  const check = useAction(client, detail.reload);
  const data = detail.data;

  return (
    <div className="h-page">
      <style>{styles}</style>
      <p className="h-breadcrumb">
        <PageLink client={client} to={pagePath.overview}>
          Service health
        </PageLink>
        {" / "}
        {data?.service.name ?? serviceId}
      </p>

      {detail.error && !data && <Notice tone="error">{detail.error}</Notice>}
      {!data && !detail.error && <Notice>Loading service…</Notice>}
      {data && (
        <>
          <Header
            data={data}
            now={now}
            checking={check.pending}
            onCheck={() =>
              void check.run("check-now", { serviceIds: [serviceId] })
            }
          />
          {check.error && <Notice tone="error">{check.error}</Notice>}
          {detail.error && (
            <Notice tone="error">Refresh failed: {detail.error}</Notice>
          )}

          <div className="h-tiles">
            {data.ranges.map((range) => (
              <Tile
                key={range.days}
                label={
                  range.days === 1
                    ? "Uptime, 24 hours"
                    : `Uptime, ${range.days} days`
                }
                value={percent(
                  range.availability,
                  range.availability !== null && range.availability >= 99.9
                    ? 3
                    : 2,
                )}
                detail={
                  range.measured === 0
                    ? "No measurements yet"
                    : `${percent(range.healthyShare, 1)} fully healthy · ${range.measured} checks`
                }
              />
            ))}
          </div>

          <Objective client={client} data={data} onChange={detail.reload} />

          <Section
            title="Availability"
            detail="One bar per hour for the last 7 days, and per day for the last 90. Grey means nothing was measured."
          >
            <div className="h-card">
              <Strip
                buckets={data.strip}
                unit="hour"
                height={34}
                label="Availability, last seven days by hour"
              />
              <Strip
                buckets={data.daily}
                unit="day"
                height={34}
                label="Availability, last ninety days by day"
              />
            </div>
          </Section>

          <Section
            title="Response time"
            detail="Adapter health check duration. Slow does not mean unavailable."
          >
            <div className="h-tiles">
              <Tile
                label="Median"
                value={millis(data.ranges.find((r) => r.days === 7)?.p50)}
                detail="7 days"
              />
              <Tile
                label="95th percentile"
                value={millis(data.ranges.find((r) => r.days === 7)?.p95)}
                detail="7 days"
              />
              <Tile
                label="99th percentile"
                value={millis(data.ranges.find((r) => r.days === 7)?.p99)}
                detail="7 days"
              />
            </div>
            <div className="h-card">
              <LatencyChart points={data.latency} />
            </div>
          </Section>

          <Section
            title="Checks"
            detail="Signals reported by the adapter at the last check."
          >
            {data.state && data.state.checks.length > 0 ? (
              <ul className="h-checks">
                {data.state.checks.map((check) => (
                  <li key={check.id}>
                    <span
                      className="h-mark"
                      data-ok={check.ok}
                      aria-hidden="true"
                    />
                    <span>
                      <strong>{check.label}</strong>
                      <span className="h-since">
                        {check.ok ? "Passing" : "Failing"}
                      </span>
                    </span>
                    <span className="h-muted h-wrap">
                      {check.detail ?? ""}
                      {check.href && !check.ok && (
                        <>
                          {check.detail ? " " : ""}
                          <a
                            className="h-link"
                            href={`/services/${encodeURIComponent(data.service.id)}${check.href}`}
                          >
                            Open in service
                          </a>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                {data.state
                  ? "This adapter reports no individual checks."
                  : "Waiting for the first check."}
              </Empty>
            )}
          </Section>

          {data.transitions.length > 0 && (
            <Section
              title="Recent changes"
              detail="Checks that changed result in the last 30 days."
            >
              <ul className="h-checks">
                {data.transitions.map((change) => (
                  <li key={`${change.checkId}-${change.time}`}>
                    <span
                      className="h-mark"
                      data-ok={change.ok}
                      aria-hidden="true"
                    />
                    <span>
                      <strong>{change.label}</strong>
                      <span className="h-since">
                        {change.ok ? "Recovered" : "Started failing"}
                      </span>
                    </span>
                    <span className="h-muted h-num">
                      {dateTime(change.time)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {data.activity.length > 0 && (
            <Section
              title="Recent activity"
              detail="Signals from other parts of DSUI for this service in the last 7 days."
            >
              <ActivityList items={data.activity} />
            </Section>
          )}

          <Section title="Incidents">
            {data.incidents.length === 0 ? (
              <Empty>No incidents recorded for this service.</Empty>
            ) : (
              <div className="h-table-wrap">
                <table className="h-table">
                  <thead>
                    <tr>
                      <th scope="col">Incident</th>
                      <th scope="col">Status</th>
                      <th scope="col">Opened</th>
                      <th scope="col" className="h-right">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.incidents.map((incident) => (
                      <tr key={incident.id}>
                        <td className="h-clip" title={incident.summary}>
                          <PageLink
                            client={client}
                            to={pagePath.incident(incident.id)}
                          >
                            {incident.summary}
                          </PageLink>
                        </td>
                        <td>
                          {incident.status === "resolved"
                            ? "Resolved"
                            : incident.status === "acknowledged"
                              ? "Acknowledged"
                              : "Open"}
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
            title="Maintenance"
            detail="Maintenance is excluded from uptime. A silence mutes incidents and signals but still counts as downtime."
          >
            <SuppressionList
              client={client}
              items={data.suppressions}
              now={now}
              onChange={detail.reload}
              showService={false}
            />
            <SuppressionForm
              client={client}
              serviceId={serviceId}
              onCreated={detail.reload}
            />
          </Section>
        </>
      )}
    </div>
  );
}

function Header({
  data,
  now,
  checking,
  onCheck,
}: {
  data: ServiceDetail;
  now: number;
  checking: boolean;
  onCheck: () => void;
}) {
  const { service, state } = data;
  const status = state?.maintenance
    ? "maintenance"
    : (state?.health ?? "unknown");
  return (
    <div className="h-card">
      <div className="h-header">
        <div className="h-header-title">
          {service.iconUrl && <img src={service.iconUrl} alt="" />}
          <div>
            <h1>{service.name}</h1>
            <p>{service.adapter}</p>
          </div>
        </div>
        <div className="h-section-actions">
          <Pill status={status} />
          <a
            className="h-button"
            href={`/services/${encodeURIComponent(service.id)}`}
          >
            Open service
          </a>
          <button
            type="button"
            className="h-button"
            disabled={checking}
            onClick={onCheck}
          >
            {checking ? "Checking…" : "Check now"}
          </button>
        </div>
      </div>
      {state ? (
        <div className="h-facts">
          <span>
            In this state for <b>{duration(now - state.since)}</b>
          </span>
          <span>
            Last checked <b>{ago(state.lastCheckedAt, now)}</b>
          </span>
          <span>
            Next check <b>{until(state.nextCheckAt, now)}</b>
          </span>
          {state.latencyMs !== undefined && (
            <span>
              Response <b>{millis(state.latencyMs)}</b>
            </span>
          )}
          {state.score !== undefined && (
            <span>
              Score <b>{Math.round(state.score)} / 100</b>
            </span>
          )}
          {state.silenced && !state.maintenance && (
            <span>
              <b>Silenced</b>
            </span>
          )}
        </div>
      ) : (
        <p className="h-muted">Waiting for the first check.</p>
      )}
      {state?.detail && <p className="h-muted">{state.detail}</p>}
    </div>
  );
}

function Objective({
  client,
  data,
  onChange,
}: {
  client: Client;
  data: ServiceDetail;
  onChange: () => void;
}) {
  const { useState } = React;
  const slo = data.slo;
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(
    String(slo?.budget.targetPercent ?? 99.9),
  );
  const [windowDays, setWindowDays] = useState(
    String(slo?.budget.windowDays ?? 30),
  );
  const save = useAction(client, () => {
    setEditing(false);
    onChange();
  });
  const clear = useAction(client, onChange);
  const budget = slo?.budget;
  const remaining = budget?.remainingFraction ?? null;
  const level =
    remaining === null
      ? undefined
      : remaining <= 0
        ? "spent"
        : remaining < 0.25
          ? "low"
          : "ok";

  return (
    <Section
      title="Objective"
      detail="An availability target and how much of its error budget is left."
      actions={
        !editing && (
          <button
            type="button"
            className="h-button"
            onClick={() => setEditing(true)}
          >
            {slo ? "Edit target" : "Set a target"}
          </button>
        )
      }
    >
      {editing && (
        <form
          className="h-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save.run("set-slo", {
              serviceId: data.service.id,
              targetPercent: Number(target),
              windowDays: Number(windowDays),
            });
          }}
        >
          <label className="h-field">
            Target (%)
            <input
              type="number"
              step="0.001"
              min="0"
              max="100"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </label>
          <label className="h-field">
            Window
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(e.target.value)}
            >
              {[7, 30, 90].map((days) => (
                <option key={days} value={days}>
                  {days} days
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-button"
            data-variant="primary"
            disabled={save.pending}
          >
            Save
          </button>
          <button
            type="button"
            className="h-button"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          {slo?.source === "ui" && (
            <button
              type="button"
              className="h-button"
              data-variant="danger"
              disabled={clear.pending}
              onClick={() =>
                void clear.run("clear-slo", { serviceId: data.service.id })
              }
            >
              Remove override
            </button>
          )}
          {(save.error || clear.error) && (
            <Notice tone="error">{save.error ?? clear.error}</Notice>
          )}
        </form>
      )}
      {!slo && !editing && (
        <Empty>No availability target set for this service.</Empty>
      )}
      {slo && budget && (
        <div className="h-card">
          <div className="h-facts">
            <span>
              Target <b>{budget.targetPercent}%</b> over{" "}
              <b>{budget.windowDays} days</b>
            </span>
            <span>
              Availability <b>{percent(budget.availability, 3)}</b>
            </span>
            <span>
              {budget.met === null ? (
                "No data yet"
              ) : budget.met ? (
                <b>Target met</b>
              ) : (
                <b>Target missed</b>
              )}
            </span>
            <span className="h-muted">
              {slo.source === "configuration"
                ? "From configuration"
                : "Set in the UI"}
            </span>
          </div>
          <div
            className="h-budget"
            data-level={level}
            role="progressbar"
            aria-label="Error budget remaining"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              remaining === null
                ? undefined
                : Math.max(0, Math.round(remaining * 100))
            }
          >
            <span
              style={{
                width: `${remaining === null ? 0 : Math.max(0, Math.min(1, remaining)) * 100}%`,
              }}
            />
          </div>
          <p className="h-muted">
            {remaining === null
              ? "The error budget appears once checks have been recorded."
              : remaining >= 0
                ? `${Math.round(remaining * 100)}% of the error budget remains.`
                : "The error budget is spent."}
          </p>
        </div>
      )}
    </Section>
  );
}
