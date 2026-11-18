/** Series colours tuned for DSUI's dark surfaces. */
export const SERIES_COLORS = [
  "#2870ff",
  "#50c878",
  "#edbd54",
  "#ff547f",
  "#b88cff",
  "#4cd4e0",
  "#ff9f5a",
  "#8399bd",
] as const;

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length] ?? "#2870ff";
}

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const full = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

export function formatCompact(value: number): string {
  return compact.format(value);
}

export function formatNumber(value: number): string {
  return full.format(value);
}

/** Rounds an axis maximum up to a value that divides into readable ticks. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

export function ticks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, index) => (max / count) * index);
}

const DAY_MS = 86_400_000;

/** Dates at UTC midnight read as days; anything else keeps its time. */
export function formatTime(value: number, allDays: boolean): string {
  const iso = new Date(value).toISOString();
  return allDays
    ? iso.slice(0, 10)
    : `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

export function allWholeDays(values: readonly (string | number)[]): boolean {
  return values.every(
    (value) => typeof value === "number" && value % DAY_MS === 0,
  );
}

export function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

/** SVG arc path for a pie slice or donut segment, angles in radians. */
export function arcPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  start: number,
  end: number,
): string {
  const sweep = Math.min(end - start, Math.PI * 2 - 0.0001);
  const stop = start + sweep;
  const large = sweep > Math.PI ? 1 : 0;
  const point = (radius: number, angle: number) =>
    `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  const outerArc = `M ${point(outer, start)} A ${outer} ${outer} 0 ${large} 1 ${point(outer, stop)}`;
  if (inner <= 0) return `${outerArc} L ${cx} ${cy} Z`;
  return `${outerArc} L ${point(inner, stop)} A ${inner} ${inner} 0 ${large} 0 ${point(inner, start)} Z`;
}
