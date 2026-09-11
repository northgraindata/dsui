import type {
  PageMeterData as MeterData,
  PageMeterSegment as MeterSegment,
  PageNode,
} from "@northgraindata/dsui-adapter-sdk";
import { Surface } from "@northgraindata/dsui-ui";
import { useEffect, useState } from "react";
import type { RendererClient } from "../../types/renderer-types";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const METER_TONES = new Set([
  "info",
  "healthy",
  "warning",
  "unavailable",
  "muted",
  "deep",
]);

function asMeter(value: unknown): MeterData | null {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.segments)) return null;
  const segments: MeterSegment[] = [];
  for (const entry of record.segments) {
    const segment = asRecord(entry);
    if (
      !segment ||
      typeof segment.label !== "string" ||
      typeof segment.value !== "number" ||
      !Number.isFinite(segment.value) ||
      segment.value < 0
    )
      return null;
    segments.push({
      label: segment.label,
      value: segment.value,
      tone:
        typeof segment.tone === "string" && METER_TONES.has(segment.tone)
          ? (segment.tone as MeterSegment["tone"])
          : "info",
    });
  }
  return {
    segments,
    ...(typeof record.footer === "string" ? { footer: record.footer } : {}),
  };
}

export function MeterView({
  client,
  node,
}: {
  client: RendererClient;
  node: PageNode;
}) {
  const [data, setData] = useState<MeterData | undefined>(() =>
    node.props.data ? (asMeter(node.props.data) ?? undefined) : undefined,
  );
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!node.props.source) return;
    let active = true;
    client
      .executeResource(node.props.source)
      .then((result) => {
        if (!active) return;
        const meter = asMeter(result);
        if (meter) setData(meter);
        else setError("Could not load storage");
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load storage",
          );
      });
    return () => {
      active = false;
    };
  }, [client, node.props.source]);
  if (error)
    return (
      <Surface className="p-4 text-[12px] text-unavailable" role="alert">
        {error}
      </Surface>
    );
  if (!data)
    return (
      <Surface className="p-5 text-[12px] text-secondary" aria-busy="true">
        Loading storage…
      </Surface>
    );
  const total = data.segments.reduce((sum, segment) => sum + segment.value, 0);
  const legend = data.segments.filter((segment) => segment.legend !== false);
  const legendTotal = legend.reduce((sum, segment) => sum + segment.value, 0);
  const header =
    total === legendTotal
      ? formatBytes(total)
      : `${formatBytes(legendTotal)} / ${formatBytes(total)}`;
  return (
    <div className="ov-meter">
      <div className="ov-meter-head">
        <span>{header}</span>
      </div>
      <div className="ov-meter-bar" aria-hidden="true">
        {data.segments.map((segment) => (
          <span
            key={segment.label}
            className="ov-meter-seg"
            data-tone={segment.tone ?? "info"}
            style={{
              width: `${total > 0 ? (segment.value / total) * 100 : 0}%`,
            }}
          />
        ))}
      </div>
      <ul className="ov-meter-legend">
        {legend.map((segment) => (
          <li key={segment.label}>
            <span
              className="ov-meter-dot"
              data-tone={segment.tone ?? "info"}
              aria-hidden="true"
            />
            <span className="ov-meter-label">{segment.label}</span>
            <span className="ov-meter-value">{formatBytes(segment.value)}</span>
            <span className="ov-meter-pct">
              {total > 0 ? Math.round((segment.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
      {data.footer ? <p className="ov-meter-foot">{data.footer}</p> : null}
    </div>
  );
}
