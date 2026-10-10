import type { ChartType, ModuleDefinition } from "./api";

type Row = Record<string, unknown>;

export function rowsFromResource(value: unknown, path: string): Row[] {
  let selected = value;
  for (const segment of path.split(".").filter(Boolean)) {
    if (!selected || typeof selected !== "object" || Array.isArray(selected))
      return [];
    selected = (selected as Row)[segment];
  }
  if (!Array.isArray(selected)) return [];
  return selected
    .filter(
      (item): item is Row =>
        !!item && typeof item === "object" && !Array.isArray(item),
    )
    .slice(0, 100);
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() &&
    Number.isFinite(Number(value))
  )
    return Number(value);
  return null;
}

function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number")
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(value);
  if (typeof value === "string" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

function Graph({
  rows,
  type,
  x,
  y,
  unit,
  accentColor,
  showGrid,
}: {
  rows: Row[];
  type: Extract<ChartType, "line" | "bar">;
  x: string;
  y: string;
  unit: string;
  accentColor: string;
  showGrid: boolean;
}) {
  const points = rows
    .map((row) => ({ label: display(row[x]), value: numeric(row[y]) }))
    .filter(
      (point): point is { label: string; value: number } =>
        point.value !== null,
    );
  if (!points.length)
    return (
      <div className="analytics-empty-visual">
        Choose numeric X/Y fields that exist in the query result.
      </div>
    );
  const shown = points.slice(0, type === "bar" ? 12 : 50);
  const min = Math.min(0, ...shown.map((point) => point.value));
  const max = Math.max(1, ...shown.map((point) => point.value));
  const span = max - min || 1;
  const xAt = (index: number) =>
    38 + (index / Math.max(1, shown.length - 1)) * 520;
  const yAt = (value: number) => 170 - ((value - min) / span) * 130;
  const baseline = yAt(0);
  return (
    <div className="analytics-graph">
      <svg
        viewBox="0 0 580 206"
        role="img"
        aria-label={`${type} chart of ${y} by ${x}`}
        preserveAspectRatio="none"
      >
        {[0, 1, 2, 3].map((tick) => (
          <g key={tick}>
            {showGrid && (
              <line
                x1="38"
                x2="565"
                y1={40 + tick * 43}
                y2={40 + tick * 43}
                stroke="#1e3152"
              />
            )}
            <text x="4" y={44 + tick * 43} fill="#8da6cc" fontSize="10">
              {display(max - (tick * span) / 3)}
            </text>
          </g>
        ))}
        {type === "line" ? (
          <polyline
            points={shown
              .map((point, index) => `${xAt(index)},${yAt(point.value)}`)
              .join(" ")}
            fill="none"
            stroke={accentColor}
            strokeWidth="3"
            strokeLinejoin="round"
          />
        ) : (
          shown.map((point, index) => {
            const width = 480 / shown.length;
            return (
              <rect
                // biome-ignore lint/suspicious/noArrayIndexKey: SVG bars have no local state and duplicate labels are valid.
                key={`${point.label}-${index}`}
                x={50 + index * (500 / shown.length)}
                y={Math.min(yAt(point.value), baseline)}
                width={Math.max(4, width - 8)}
                height={Math.max(1, Math.abs(baseline - yAt(point.value)))}
                rx="3"
                fill={accentColor}
              />
            );
          })
        )}
        {shown
          .filter(
            (_, index) =>
              index % Math.max(1, Math.ceil(shown.length / 6)) === 0,
          )
          .map((point) => {
            const index = shown.indexOf(point);
            return (
              <text
                key={`${point.label}-${index}`}
                x={
                  type === "bar"
                    ? 50 + index * (500 / shown.length)
                    : xAt(index)
                }
                y="195"
                fill="#8da6cc"
                fontSize="10"
                textAnchor="middle"
              >
                {point.label.slice(0, 10)}
              </text>
            );
          })}
      </svg>
      {unit && <span className="analytics-unit">{unit}</span>}
    </div>
  );
}

export function Visualization({
  definition,
  data,
}: {
  definition: ModuleDefinition;
  data: unknown;
}) {
  const rows = rowsFromResource(data, definition.source.rowsPath);
  if (!rows.length)
    return (
      <div className="analytics-empty-visual">
        No rows to display. Set a rows path if the resource returns an object.
      </div>
    );
  const { type, x, y, unit } = definition.chart;
  if (type === "metric")
    return (
      <div className="analytics-metric">
        <strong style={{ color: definition.styles.accentColor }}>
          {display(rows[0]?.[y || x])}
        </strong>
        <span>{unit}</span>
      </div>
    );
  if (type === "line" || type === "bar")
    return (
      <Graph
        rows={rows}
        type={type}
        x={x}
        y={y}
        unit={unit}
        accentColor={definition.styles.accentColor}
        showGrid={definition.styles.showGrid}
      />
    );
  const columns = Object.keys(rows[0] ?? {}).slice(0, 8);
  return (
    <div className="analytics-table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Resource rows may lack an ID; table cells have no local state.
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>{display(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
