export type ColumnKind =
  | "number"
  | "date"
  | "boolean"
  | "json"
  | "text"
  | "unknown";
export type QuerySortDirection = "asc" | "desc";

type Distribution =
  | { kind: "histogram"; bins: number[]; min: string; max: string }
  | {
      kind: "values";
      values: {
        key: string;
        label: string;
        count: number;
        percentage: number;
      }[];
      distinct: number;
    }
  | { kind: "empty" };

export type ColumnProfile = {
  name: string;
  type?: string;
  kind: ColumnKind;
  sampleSize: number;
  nullCount: number;
  distribution: Distribution;
};

const SAMPLE_LIMIT = 1000;
const numberLabel = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
  notation: "compact",
});
const textCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
const typePatterns: readonly [RegExp, ColumnKind][] = [
  [/DATE|TIME/i, "date"],
  [/BOOL/i, "boolean"],
  [/JSON|STRUCT|MAP|ARRAY|OBJECT|VARIANT/i, "json"],
  [
    /(?:^|[^a-z])(?:TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|U?INT\d*|DECIMAL|NUMERIC|NUMBER|FLOAT\d*|DOUBLE|REAL|MONEY|SERIAL\d*)(?:$|[^a-z0-9])/i,
    "number",
  ],
  [/CHAR|TEXT|STRING|UUID|ENUM|CLOB/i, "text"],
];

export function columnKind(
  type: string | undefined,
  values: readonly unknown[],
): ColumnKind {
  const explicitKind =
    type && typePatterns.find(([pattern]) => pattern.test(type))?.[1];
  if (explicitKind) return explicitKind;
  const first = values.find((value) => value !== null && value !== undefined);
  if (typeof first === "number" || typeof first === "bigint") return "number";
  if (typeof first === "boolean") return "boolean";
  if (first instanceof Date) return "date";
  if (typeof first === "object") return "json";
  if (typeof first === "string") return "text";
  return "unknown";
}

function histogram(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bins = Array.from({ length: 10 }, () => 0);
  for (const value of values) {
    const index =
      min === max
        ? 4
        : Math.min(9, Math.floor(((value - min) / (max - min)) * 10));
    bins[index] = (bins[index] ?? 0) + 1;
  }
  return { bins, min, max };
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function dateValue(value: unknown): number | undefined {
  if (value instanceof Date) return value.getTime();
  return typeof value === "string" ? Date.parse(value) : undefined;
}

function sortableNumber(kind: ColumnKind, value: unknown): number | undefined {
  if (kind === "date") return dateValue(value);
  if (kind === "number") return numericValue(value);
  return undefined;
}

function valueLabel(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function histogramDistribution(
  kind: "number" | "date",
  values: readonly unknown[],
): Extract<Distribution, { kind: "histogram" }> | undefined {
  const numbers = values.flatMap((value) => {
    const parsed = kind === "date" ? dateValue(value) : numericValue(value);
    return parsed !== undefined && Number.isFinite(parsed) ? [parsed] : [];
  });
  if (numbers.length === 0) return undefined;
  const stats = histogram(numbers);
  const label = (value: number) =>
    kind === "date"
      ? new Date(value).toISOString().slice(0, 10)
      : numberLabel.format(value);
  return {
    kind: "histogram",
    bins: stats.bins,
    min: label(stats.min),
    max: label(stats.max),
  };
}

function valueDistribution(
  values: readonly unknown[],
): Extract<Distribution, { kind: "values" }> {
  const counts = new Map<
    string,
    { key: string; label: string; count: number }
  >();
  for (const value of values) {
    const label = valueLabel(value);
    const key = `${typeof value}:${label}`;
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { key, label, count: 1 });
  }
  const top = [...counts.values()]
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
    )
    .slice(0, 3)
    .map(({ key, label, count }) => ({
      key,
      label,
      count,
      percentage: (count / values.length) * 100,
    }));
  return { kind: "values", values: top, distinct: counts.size };
}

function profileColumn(
  column: { name: string; type?: string },
  sample: readonly Record<string, unknown>[],
): ColumnProfile {
  const values = sample.map((row) => row[column.name]);
  const kind = columnKind(column.type, values);
  const nullCount = values.filter(
    (value) => value === null || value === undefined,
  ).length;
  let distribution: Distribution = { kind: "empty" };
  if (values.length > 0) {
    distribution =
      kind === "number" || kind === "date"
        ? (histogramDistribution(kind, values) ?? valueDistribution(values))
        : valueDistribution(values);
  }
  return {
    name: column.name,
    ...(column.type ? { type: column.type } : {}),
    kind,
    sampleSize: values.length,
    nullCount,
    distribution,
  };
}

export function columnProfiles(
  columns: readonly { name: string; type?: string }[],
  rows: readonly Record<string, unknown>[],
): ColumnProfile[] {
  const sample = rows.slice(0, SAMPLE_LIMIT);
  return columns.map((column) => profileColumn(column, sample));
}

export function sortQueryRows(
  rows: readonly Record<string, unknown>[],
  profile: ColumnProfile,
  direction: QuerySortDirection,
): Record<string, unknown>[] {
  return [...rows].sort((left, right) => {
    const first = left[profile.name];
    const second = right[profile.name];
    if (first === null || first === undefined)
      return second === null || second === undefined ? 0 : 1;
    if (second === null || second === undefined) return -1;
    const firstNumber = sortableNumber(profile.kind, first);
    const secondNumber = sortableNumber(profile.kind, second);
    const comparison =
      firstNumber !== undefined &&
      secondNumber !== undefined &&
      Number.isFinite(firstNumber) &&
      Number.isFinite(secondNumber)
        ? firstNumber - secondNumber
        : textCollator.compare(valueLabel(first), valueLabel(second));
    return direction === "asc" ? comparison : -comparison;
  });
}
