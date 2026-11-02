import type { ShaperApp } from "../context.js";

export function formatTimestamp(value: string | undefined): string {
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  return new Date(time).toISOString().replace("T", " ").slice(0, 16);
}

/** Shaper reports task durations in milliseconds. */
export function formatDuration(milliseconds: number | undefined): string {
  if (milliseconds === undefined) return "";
  if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`;
  const seconds = milliseconds / 1_000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

/** The location shown for an app, e.g. `/sales/Revenue`. */
export function appLocation(app: Pick<ShaperApp, "path" | "name">): string {
  return `${app.path}${app.name}`;
}
