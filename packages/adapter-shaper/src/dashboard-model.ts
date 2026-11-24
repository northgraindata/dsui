import type {
  ShaperColumn,
  ShaperDashboard,
  ShaperQueryResult,
} from "./context.js";

/**
 * Presentation model for a Shaper dashboard.
 *
 * Shaper evaluates a dashboard's SQL and returns column-tagged rows. This
 * module decides what each result becomes, keeping that decision free of React
 * so it can be tested against real server responses.
 */

export interface ViewColumn {
  id: string;
  label: string;
  type: string;
}

export type Primitive = string | number | boolean | null;

export interface TableBlock {
  kind: "table";
  title: string;
  columns: ViewColumn[];
  rows: Primitive[][];
  /** The server type this block stands in for, when it has no native view. */
  fallbackFor?: string;
}

export interface ValueBlock {
  kind: "value";
  title: string;
  label: string;
  value: Primitive;
  type: string;
}

export interface GaugeBlock {
  kind: "gauge";
  title: string;
  value: number;
  ranges: { from: number; to: number }[];
}

export interface Series {
  name: string;
  values: (number | null)[];
}

export interface CartesianBlock {
  kind: "line" | "bar";
  title: string;
  orientation: "vertical" | "horizontal";
  stacked: boolean;
  xType: "time" | "category";
  x: (string | number)[];
  series: Series[];
}

export interface PieBlock {
  kind: "pie";
  title: string;
  donut: boolean;
  slices: { name: string; value: number }[];
}

export interface ControlBlock {
  kind: "control";
  control: "dropdown" | "dropdownMulti" | "input" | "datepicker";
  title: string;
  /** The dashboard variable this control sets. */
  variable: string;
  options: string[];
}

export type Block =
  | TableBlock
  | ValueBlock
  | GaugeBlock
  | CartesianBlock
  | PieBlock
  | ControlBlock;

export interface ViewSection {
  title: string | null;
  subtitle: string | null;
  blocks: Block[];
}

export interface DashboardView {
  title: string;
  sections: ViewSection[];
  /** Milliseconds since the epoch, or null when the data does not expire. */
  reloadAt: number | null;
  /** Variables the dashboard needs that no control has a value for. */
  unsetVariables: string[];
}

/**
 * Column names arrive as the SQL expression Shaper evaluated, so a tagged
 * column reads `CAST(CAST(d AS "DATE") AS "XAXIS")`. Unwrapping the casts
 * recovers the name the author wrote.
 */
export function columnLabel(name: string): string {
  let current = name.trim();
  for (let depth = 0; depth < 8; depth++) {
    const match = /^CAST\(([\s\S]*) AS "[A-Za-z_]+"\)$/.exec(current);
    const inner = match?.[1];
    if (inner === undefined) break;
    current = inner.trim();
  }
  return current.replace(/^"([\s\S]*)"$/, "$1");
}

function primitive(value: unknown): Primitive {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return value;
  return JSON.stringify(value);
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toTable(query: ShaperQueryResult, fallbackFor?: string): TableBlock {
  return {
    kind: "table",
    title: query.render.label ?? "",
    columns: query.columns.map((column, index) => ({
      id: String(index),
      label: columnLabel(column.name),
      type: column.type,
    })),
    rows: query.rows.map((row) => row.map(primitive)),
    ...(fallbackFor ? { fallbackFor } : {}),
  };
}

function firstByTag(columns: readonly ShaperColumn[], tag: string) {
  const index = columns.findIndex((column) => column.tag === tag);
  return index === -1 ? undefined : index;
}

function toCartesian(
  query: ShaperQueryResult,
  kind: "line" | "bar",
  orientation: "vertical" | "horizontal",
  stacked: boolean,
): CartesianBlock | undefined {
  const { columns } = query;
  const categoryColumn = firstByTag(columns, "category");
  const indexColumn = firstByTag(columns, "index");
  const xColumn = indexColumn ?? categoryColumn;
  const valueColumns = columns.flatMap((column, position) =>
    column.tag === "value" ? [position] : [],
  );
  if (xColumn === undefined || valueColumns.length === 0) return undefined;

  const xTime = ["date", "timestamp", "time"].includes(
    columns[xColumn]?.type ?? "",
  );
  const key = (row: readonly unknown[]) => {
    const value = row[xColumn];
    return xTime && typeof value === "number" ? value : String(value ?? "");
  };

  // Rows are a long table: one per (x, category). Pivot to aligned series.
  const split =
    indexColumn !== undefined && categoryColumn !== undefined
      ? categoryColumn
      : undefined;
  const x: (string | number)[] = [];
  const seen = new Set<string | number>();
  for (const row of query.rows) {
    const value = key(row);
    if (!seen.has(value)) {
      seen.add(value);
      x.push(value);
    }
  }
  if (xTime) x.sort((a, b) => Number(a) - Number(b));
  const position = new Map(x.map((value, index) => [value, index]));

  const series = new Map<string, (number | null)[]>();
  const slot = (name: string) => {
    let values = series.get(name);
    if (!values) {
      values = x.map(() => null);
      series.set(name, values);
    }
    return values;
  };
  for (const row of query.rows) {
    const at = position.get(key(row));
    if (at === undefined) continue;
    for (const valueColumn of valueColumns) {
      const name =
        split !== undefined
          ? String(row[split] ?? "")
          : columnLabel(columns[valueColumn]?.name ?? "");
      const target = slot(
        valueColumns.length > 1 && split !== undefined
          ? `${name} · ${columnLabel(columns[valueColumn]?.name ?? "")}`
          : name,
      );
      target[at] = numeric(row[valueColumn]);
    }
  }

  return {
    kind,
    title: query.render.label ?? "",
    orientation,
    stacked,
    xType: xTime ? "time" : "category",
    x,
    series: [...series].map(([name, values]) => ({ name, values })),
  };
}

function toPie(query: ShaperQueryResult, donut: boolean): PieBlock | undefined {
  const category = firstByTag(query.columns, "category");
  const value = firstByTag(query.columns, "value");
  if (category === undefined || value === undefined) return undefined;
  const slices = query.rows.flatMap((row) => {
    const amount = numeric(row[value]);
    return amount === null || amount < 0
      ? []
      : [{ name: String(row[category] ?? ""), value: amount }];
  });
  return { kind: "pie", title: query.render.label ?? "", donut, slices };
}

function toGauge(query: ShaperQueryResult): GaugeBlock | undefined {
  const value = numeric(query.rows[0]?.[0]);
  if (value === null) return undefined;
  const ranges = Array.isArray(query.render.gaugeCategories)
    ? query.render.gaugeCategories.flatMap((entry: unknown) => {
        if (!entry || typeof entry !== "object") return [];
        const from = numeric((entry as { from?: unknown }).from);
        const to = numeric((entry as { to?: unknown }).to);
        return from === null || to === null ? [] : [{ from, to }];
      })
    : [];
  return {
    kind: "gauge",
    title: query.render.label ?? "",
    value,
    ranges:
      ranges.length > 0 ? ranges : [{ from: 0, to: Math.max(100, value) }],
  };
}

function toValue(query: ShaperQueryResult): ValueBlock | undefined {
  const column = query.columns[0];
  const row = query.rows[0];
  if (!column || !row) return undefined;
  return {
    kind: "value",
    title: query.render.label ?? "",
    label: columnLabel(column.name),
    value: primitive(row[0]),
    type: column.type,
  };
}

const CONTROLS = {
  dropdown: "dropdown",
  dropdownMulti: "dropdownMulti",
  input: "input",
  datepicker: "datepicker",
} as const;

function toControl(
  query: ShaperQueryResult,
  control: ControlBlock["control"],
): ControlBlock | undefined {
  const column = query.columns[0];
  if (!column) return undefined;
  return {
    kind: "control",
    control,
    title: query.render.label ?? columnLabel(column.name),
    variable: columnLabel(column.name),
    options: query.rows.map((row) => String(row[0] ?? "")),
  };
}

/** Maps one server result to a block; unknown types keep their data as a table. */
export function toBlock(query: ShaperQueryResult): Block | undefined {
  const type = query.render.type;
  switch (type) {
    case "placeholder":
      return undefined;
    case "table":
      return toTable(query);
    case "value":
      return toValue(query) ?? toTable(query);
    case "gauge":
      return toGauge(query) ?? toTable(query, type);
    case "linechart":
      return (
        toCartesian(query, "line", "vertical", false) ?? toTable(query, type)
      );
    case "barchartVertical":
      return (
        toCartesian(query, "bar", "vertical", false) ?? toTable(query, type)
      );
    case "barchartVerticalStacked":
      return (
        toCartesian(query, "bar", "vertical", true) ?? toTable(query, type)
      );
    case "barchartHorizontal":
      return (
        toCartesian(query, "bar", "horizontal", false) ?? toTable(query, type)
      );
    case "barchartHorizontalStacked":
      return (
        toCartesian(query, "bar", "horizontal", true) ?? toTable(query, type)
      );
    case "piechart":
      return toPie(query, false) ?? toTable(query, type);
    case "donutchart":
      return toPie(query, true) ?? toTable(query, type);
    case "dropdown":
    case "dropdownMulti":
    case "input":
    case "datepicker":
      return toControl(query, CONTROLS[type]) ?? toTable(query, type);
    default:
      return toTable(query, type);
  }
}

export function buildDashboardView(
  dashboard: ShaperDashboard,
  fallbackTitle = "",
): DashboardView {
  return {
    title: dashboard.name || fallbackTitle,
    sections: dashboard.sections.flatMap((section) => {
      const blocks = section.queries.flatMap((query) => {
        const block = toBlock(query);
        return block ? [block] : [];
      });
      if (blocks.length === 0 && !section.title) return [];
      return [
        {
          title: section.title,
          subtitle: section.subtitle ?? null,
          blocks,
        },
      ];
    }),
    reloadAt:
      dashboard.reloadAt && dashboard.reloadAt > 0 ? dashboard.reloadAt : null,
    unsetVariables: dashboard.unsetVariables ?? [],
  };
}

export interface DashboardSummaryQuery {
  title: string;
  type: string;
  columns: string[];
  rows: Primitive[][];
  /** Rows the server returned beyond the ones included here. */
  omittedRows: number;
}

export interface DashboardSummary {
  name: string;
  sections: {
    title: string | null;
    queries: DashboardSummaryQuery[];
  }[];
}

const SUMMARY_ROWS = 50;

function summaryCell(value: unknown, type: string): Primitive {
  if (
    typeof value === "number" &&
    (type === "date" || type === "timestamp") &&
    Number.isFinite(value)
  ) {
    const iso = new Date(value).toISOString();
    return type === "date" ? iso.slice(0, 10) : iso;
  }
  return primitive(value);
}

/**
 * A dashboard reduced to what a reader (or an AI agent) needs to quote its
 * numbers: readable column names, ISO dates and a bounded number of rows.
 */
export function summarizeDashboard(
  dashboard: ShaperDashboard,
  fallbackName = "",
): DashboardSummary {
  return {
    name: dashboard.name || fallbackName,
    sections: dashboard.sections.map((section) => ({
      title: section.title,
      queries: section.queries.map((query) => ({
        title: query.render.label ?? "",
        type: query.render.type,
        columns: query.columns.map((column) => columnLabel(column.name)),
        rows: query.rows
          .slice(0, SUMMARY_ROWS)
          .map((row) =>
            row.map((cell, at) =>
              summaryCell(cell, query.columns[at]?.type ?? ""),
            ),
          ),
        omittedRows: Math.max(0, query.rows.length - SUMMARY_ROWS),
      })),
    })),
  };
}
