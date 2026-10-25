import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import type { ReactNode } from "react";
import type { StripBucket } from "../contract";
import { React } from "../react";
import {
  dateTime,
  millis,
  offset,
  type Status,
  signalName,
  statusLabel,
} from "./format";

type Client = ComponentProps["client"];

/** An in-app link that navigates without reloading the page. */
export function PageLink({
  client,
  to,
  className,
  children,
}: {
  client: Client;
  /** Path relative to the plugin, e.g. `health/incidents`. */
  to: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      className={className}
      href={`/plugins/health/${to}`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button)
          return;
        event.preventDefault();
        client.navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function Pill({ status, label }: { status: Status; label?: string }) {
  return (
    <span className="h-pill" data-status={status}>
      <i aria-hidden="true" />
      {label ?? statusLabel[status]}
    </span>
  );
}

export function Tile({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  status?: Status;
}) {
  return (
    <div className="h-tile" data-status={status}>
      <span className="h-tile-label">{label}</span>
      <strong>{value}</strong>
      {detail ? <span className="h-tile-detail">{detail}</span> : null}
    </div>
  );
}

export function Section({
  title,
  detail,
  actions,
  children,
}: {
  title: string;
  detail?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="h-section">
      <header>
        <div>
          <h2>{title}</h2>
          {detail ? <p>{detail}</p> : null}
        </div>
        {actions ? <div className="h-section-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error";
  children: ReactNode;
}) {
  return (
    <p
      className="h-notice"
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="h-empty">{children}</p>;
}

/**
 * One bar per bucket. Gaps stay visible: a grey bar means nothing was
 * measured, not that the service was fine.
 */
export function Strip({
  buckets,
  unit,
  height = 24,
  label,
}: {
  buckets: readonly StripBucket[];
  unit: "hour" | "day";
  height?: number;
  label: string;
}) {
  const step = 4;
  return (
    <svg
      className="h-strip"
      viewBox={`0 0 ${buckets.length * step} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      style={{ height }}
    >
      {buckets.map((bucket, index) => (
        <rect
          key={bucket.time}
          x={index * step}
          y={1}
          width={step - 1.4}
          height={height - 2}
          rx={1}
          data-status={bucket.health ?? "missing"}
        >
          <title>
            {unit === "hour"
              ? dateTime(bucket.time)
              : new Date(bucket.time).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
            {": "}
            {bucket.health ? statusLabel[bucket.health] : "No measurement"}
            {bucket.samples ? ` · ${bucket.samples} checks` : ""}
            {bucket.latencyMs !== null
              ? ` · ${millis(bucket.latencyMs)} average`
              : ""}
          </title>
        </rect>
      ))}
    </svg>
  );
}

export type LatencyPoint = {
  time: number;
  average: number | null;
  p95: number | null;
};

/** Average and 95th percentile latency, with gaps where nothing was measured. */
export function LatencyChart({ points }: { points: readonly LatencyPoint[] }) {
  const width = 720;
  const height = 150;
  const pad = { top: 8, right: 8, bottom: 20, left: 44 };
  const values = points.flatMap((point) =>
    [point.average, point.p95].filter(
      (value): value is number => value !== null,
    ),
  );
  if (values.length === 0)
    return <p className="h-empty">No latency measurements yet.</p>;
  const max = Math.max(...values) * 1.1 || 1;
  const x = (index: number) =>
    pad.left +
    (index / Math.max(1, points.length - 1)) * (width - pad.left - pad.right);
  const y = (value: number) =>
    pad.top + (1 - value / max) * (height - pad.top - pad.bottom);
  const path = (pick: (point: LatencyPoint) => number | null) => {
    let d = "";
    let pen = false;
    points.forEach((point, index) => {
      const value = pick(point);
      if (value === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };
  const ticks = [0, 0.5, 1].map((fraction) => fraction * max);
  const first = points[0];
  const last = points.at(-1);
  return (
    <div className="h-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Response time over the last seven days"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              className="h-chart-grid"
            />
            <text x={pad.left - 6} y={y(tick) + 3} textAnchor="end">
              {millis(tick)}
            </text>
          </g>
        ))}
        <path d={path((point) => point.p95)} className="h-chart-p95" />
        <path d={path((point) => point.average)} className="h-chart-average" />
        {points.map((point, index) =>
          point.average !== null &&
          points[index - 1]?.average == null &&
          points[index + 1]?.average == null ? (
            <circle
              key={point.time}
              cx={x(index)}
              cy={y(point.average)}
              r={2.2}
              className="h-chart-dot"
            />
          ) : null,
        )}
        {points.map((point, index) => (
          <rect
            key={point.time}
            x={x(index) - 2}
            y={pad.top}
            width={4}
            height={height - pad.top - pad.bottom}
            fill="transparent"
          >
            <title>
              {dateTime(point.time)} · average {millis(point.average)} · p95{" "}
              {millis(point.p95)}
            </title>
          </rect>
        ))}
        {first && last ? (
          <>
            <text x={pad.left} y={height - 5}>
              {dateTime(first.time)}
            </text>
            <text x={width - pad.right} y={height - 5} textAnchor="end">
              {dateTime(last.time)}
            </text>
          </>
        ) : null}
      </svg>
      <div className="h-legend">
        <span data-series="average">Average</span>
        <span data-series="p95">95th percentile</span>
      </div>
    </div>
  );
}

export type ActivityRow = {
  id: number;
  signalId: string;
  type: string;
  time: number;
  summary: string | null;
  count: number;
  offsetMs?: number;
};

/** Signals from other sources, newest context first as given. */
export function ActivityList({ items }: { items: readonly ActivityRow[] }) {
  return (
    <ul className="h-checks">
      {items.map((item) => {
        const { source, name } = signalName(item.signalId);
        return (
          <li key={item.id}>
            <span className="h-mark" data-tone={item.type} aria-hidden="true" />
            <span>
              <strong>
                {name}
                {item.count > 1 ? ` (${item.count}x)` : ""}
              </strong>
              <span className="h-since">
                {source}
                {item.summary ? ` · ${item.summary}` : ""}
              </span>
            </span>
            <span className="h-muted h-num">
              {item.offsetMs === undefined
                ? dateTime(item.time)
                : offset(item.offsetMs)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
