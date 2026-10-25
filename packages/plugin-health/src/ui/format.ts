import type { Health } from "../context";

export type Status = Health | "maintenance";

export const statusLabel: Record<Status, string> = {
  healthy: "Healthy",
  warning: "Degraded",
  unavailable: "Unavailable",
  unknown: "Unknown",
  maintenance: "Maintenance",
};

/** Order for lists: what needs attention first. */
export const attentionOrder: Record<Health, number> = {
  unavailable: 0,
  warning: 1,
  unknown: 2,
  healthy: 3,
};

export function percent(value: number | null, digits = 2): string {
  if (value === null) return "—";
  if (value >= 100) return "100%";
  // 99.999 must not round up to a flat 100: that would claim perfection.
  const floored = Math.floor(value * 10 ** digits) / 10 ** digits;
  return `${floored.toFixed(digits)}%`;
}

export function millis(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value >= 10_000) return `${(value / 1000).toFixed(1)} s`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

export function duration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function ago(time: number | null, now: number): string {
  if (time === null) return "never";
  const seconds = Math.round((now - time) / 1000);
  if (seconds < 10) return "just now";
  return `${duration(now - time)} ago`;
}

export function until(time: number, now: number): string {
  return time <= now ? "now" : `in ${duration(time - now)}`;
}

export function dateTime(time: number): string {
  return new Date(time).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Value for a `datetime-local` input, in local time. */
export function toInputValue(time: number): string {
  const date = new Date(time - new Date(time).getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

export function fromInputValue(value: string): number {
  return new Date(value).getTime();
}

export const pagePath = {
  service: (id: string) => `health/services/${encodeURIComponent(id)}`,
  incident: (id: string) => `health/incidents/${encodeURIComponent(id)}`,
  incidents: "health/incidents",
  overview: "health",
};

/** "12m before" / "2m after" relative to a moment, for the activity lists. */
export function offset(ms: number): string {
  if (Math.abs(ms) < 30_000) return "at the same time";
  return `${duration(Math.abs(ms))} ${ms < 0 ? "before" : "after"}`;
}

/** "Run failed" from "dbt.run-failed", with the source kept separate. */
export function signalName(signalId: string): { source: string; name: string } {
  const [source = "", ...rest] = signalId.split(".");
  const raw = (rest.length > 0 ? rest.join(" ") : source).replace(/-/g, " ");
  return {
    source: rest.length > 0 ? source : "",
    name: raw.charAt(0).toUpperCase() + raw.slice(1),
  };
}

/** Change between two percentages, in percentage points. */
export function delta(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return "no earlier data";
  const diff = current - previous;
  if (Math.abs(diff) < 0.005) return "same as before";
  return `${diff > 0 ? "up" : "down"} ${Math.abs(diff).toFixed(2)} pp`;
}
