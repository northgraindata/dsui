import { useEffect, useRef, useState } from "react";
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
  height,
}: {
  rows: Row[];
  type: Extract<ChartType, "line" | "bar" | "area">;
  x: string;
  y: string;
  unit: string;
  accentColor: string;
  showGrid: boolean;
  height: ModuleDefinition["styles"]["height"];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(580);
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [tooltipPoint, setTooltipPoint] = useState<number | null>(null);
  const showPoint = (index: number) => {
    setActivePoint(index);
    setTooltipPoint(index);
  };
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      if (container.clientWidth > 0)
        setChartWidth(Math.round(container.clientWidth));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
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
  const chartHeight =
    height === "compact" ? 140 : height === "tall" ? 260 : 194;
  const tickValues = [max, max - span / 3, max - (2 * span) / 3, min];
  const left = Math.max(
    38,
    ...tickValues.map((tick) => display(tick).length * 7 + 12),
  );
  const right = Math.max(left + 40, chartWidth - 14);
  const plotWidth = right - left;
  const top = 22;
  const bottom = chartHeight - 29;
  const yAt = (value: number) =>
    bottom - ((value - min) / span) * (bottom - top);
  const xAt = (index: number) =>
    type === "bar"
      ? left + ((index + 0.5) / shown.length) * plotWidth
      : left + (index / Math.max(1, shown.length - 1)) * plotWidth;
  const baseline = yAt(0);
  const barWidth = Math.min(64, (plotWidth / shown.length) * 0.7);
  const labelStep = Math.max(
    1,
    Math.ceil(shown.length / Math.max(2, Math.floor(plotWidth / 90))),
  );
  const hoveredPoint = tooltipPoint !== null ? shown[tooltipPoint] : undefined;
  return (
    <div className="analytics-graph" ref={containerRef}>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label={`${type} chart of ${y} by ${x}`}
        style={{ height: chartHeight }}
      >
        {tickValues.map((value) => (
          <g key={value}>
            {(showGrid || type === "bar") && (
              <line
                x1={left}
                x2={right}
                y1={yAt(value)}
                y2={yAt(value)}
                stroke="#1e3152"
              />
            )}
            <text
              x={left - 10}
              y={yAt(value) + 4}
              fill="#8da6cc"
              fontSize="11"
              textAnchor="end"
            >
              {display(value)}
            </text>
          </g>
        ))}
        {type === "line" || type === "area" ? (
          <>
            {type === "area" && (
              <polygon
                className="analytics-area-fill"
                points={[
                  `${xAt(0)},${baseline}`,
                  ...shown.map(
                    (point, index) => `${xAt(index)},${yAt(point.value)}`,
                  ),
                  `${xAt(shown.length - 1)},${baseline}`,
                ].join(" ")}
                fill={accentColor}
              />
            )}
            <polyline
              className="analytics-line-path"
              points={shown
                .map((point, index) => `${xAt(index)},${yAt(point.value)}`)
                .join(" ")}
              pathLength={1}
              fill="none"
              stroke={accentColor}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {shown.map((point, index) => (
              <g
                // biome-ignore lint/suspicious/noArrayIndexKey: Query rows can share X values; markers have no local state.
                key={`${point.label}-${index}`}
                className="analytics-line-point"
                style={{
                  animationDelay: `${(index / Math.max(1, shown.length - 1)) * 850}ms`,
                }}
              >
                <circle
                  className={`analytics-point-marker ${activePoint === index ? "analytics-point-marker--active" : ""}`}
                  cx={xAt(index)}
                  cy={yAt(point.value)}
                  r="4"
                  fill={accentColor}
                  stroke="#07172b"
                  strokeWidth="2"
                  pointerEvents="none"
                />
              </g>
            ))}
          </>
        ) : (
          shown.map((point, index) => (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: SVG bars have no local state and duplicate labels are valid.
              key={`${point.label}-${index}`}
              className={`analytics-chart-bar ${activePoint === index ? "analytics-chart-bar--active" : ""}`}
              style={{
                animationDelay: `${index * 45}ms`,
                transformOrigin:
                  point.value >= 0 ? "center bottom" : "center top",
              }}
              x={xAt(index) - barWidth / 2}
              y={Math.min(yAt(point.value), baseline)}
              width={barWidth}
              height={Math.max(1, Math.abs(baseline - yAt(point.value)))}
              rx="3"
              fill={accentColor}
            />
          ))
        )}
        {shown.map((point, index) =>
          index === 0 ||
          index === shown.length - 1 ||
          index % labelStep === 0 ? (
            <text
              // biome-ignore lint/suspicious/noArrayIndexKey: Labels may repeat and have no local state.
              key={`${point.label}-${index}`}
              x={xAt(index)}
              y={chartHeight - 7}
              fill="#8da6cc"
              fontSize="11"
              textAnchor={
                type === "bar"
                  ? "middle"
                  : index === 0
                    ? "start"
                    : index === shown.length - 1
                      ? "end"
                      : "middle"
              }
            >
              {point.label.slice(0, 14)}
            </text>
          ) : null,
        )}
      </svg>
      {(type === "line" || type === "area") &&
        shown.map((point, index) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: Query rows can share X values; hit targets have no local state.
            key={`${point.label}-${index}`}
            type="button"
            className="analytics-point-hit"
            aria-label={`${point.label}: ${display(point.value)} ${unit || y}`}
            style={{ left: xAt(index), top: 14 + yAt(point.value) }}
            onMouseEnter={() => showPoint(index)}
            onMouseLeave={() => setActivePoint(null)}
            onFocus={() => showPoint(index)}
            onBlur={() => setActivePoint(null)}
            onClick={() => showPoint(index)}
          />
        ))}
      {type === "bar" &&
        shown.map((point, index) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: Query rows can share X values; hit targets have no local state.
            key={`${point.label}-${index}`}
            type="button"
            className="analytics-bar-hit"
            aria-label={`${x}: ${point.label}, ${y}: ${display(point.value)}${unit ? ` ${unit}` : ""}`}
            style={{
              left: xAt(index) - barWidth / 2,
              top: 14 + Math.min(yAt(point.value), baseline),
              width: barWidth,
              height: Math.max(12, Math.abs(baseline - yAt(point.value))),
            }}
            onMouseEnter={() => showPoint(index)}
            onMouseLeave={() => setActivePoint(null)}
            onFocus={() => showPoint(index)}
            onBlur={() => setActivePoint(null)}
            onClick={() => showPoint(index)}
          />
        ))}
      {unit && <span className="analytics-unit">{unit}</span>}
      {hoveredPoint && tooltipPoint !== null && (
        <div
          className={`analytics-chart-tooltip ${yAt(hoveredPoint.value) < 65 ? "analytics-chart-tooltip--below" : ""} ${activePoint !== null ? "analytics-chart-tooltip--visible" : ""}`}
          role="tooltip"
          aria-hidden={activePoint === null}
          style={{
            left: Math.max(84, Math.min(chartWidth - 84, xAt(tooltipPoint))),
            top: 14 + yAt(hoveredPoint.value),
          }}
        >
          <span>
            {type === "bar" ? `${x}: ` : ""}
            {hoveredPoint.label}
          </span>
          <strong>
            {type === "bar" ? `${y}: ` : ""}
            {display(hoveredPoint.value)} {unit && ` ${unit}`}
            {type !== "bar" && !unit && ` ${y}`}
          </strong>
        </div>
      )}
    </div>
  );
}

function HorizontalBars({
  rows,
  x,
  y,
  unit,
  accentColor,
}: {
  rows: Row[];
  x: string;
  y: string;
  unit: string;
  accentColor: string;
}) {
  const [activeBar, setActiveBar] = useState<number | null>(null);
  const points = rows
    .map((row) => ({ label: display(row[x]), value: numeric(row[y]) }))
    .filter(
      (point): point is { label: string; value: number } =>
        point.value !== null,
    )
    .slice(0, 12);
  if (!points.length)
    return (
      <div className="analytics-empty-visual">
        Choose a category field and a numeric value field in the query result.
      </div>
    );
  const min = Math.min(0, ...points.map((point) => point.value));
  const max = Math.max(0, ...points.map((point) => point.value));
  const span = max - min || 1;
  const zero = ((0 - min) / span) * 100;
  return (
    <div className="analytics-horizontal-bars">
      {points.map((point, index) => {
        const value = ((point.value - min) / span) * 100;
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Query rows can share categories; bars have no local state.
            key={`${point.label}-${index}`}
            className={`analytics-horizontal-row ${activeBar === index ? "analytics-horizontal-row--active" : ""}`}
          >
            <span className="analytics-horizontal-label" title={point.label}>
              {point.label}
            </span>
            <div className="analytics-horizontal-track">
              <span
                className="analytics-horizontal-zero"
                style={{ left: `${zero}%` }}
              />
              <button
                type="button"
                className="analytics-horizontal-bar"
                aria-label={`${x}: ${point.label}, ${y}: ${display(point.value)}${unit ? ` ${unit}` : ""}`}
                style={{
                  left: `${Math.min(zero, value)}%`,
                  width: `${Math.max(1, Math.abs(value - zero))}%`,
                  backgroundColor: accentColor,
                  transformOrigin: point.value >= 0 ? "left" : "right",
                  animationDelay: `${index * 45}ms`,
                }}
                onMouseEnter={() => setActiveBar(index)}
                onMouseLeave={() => setActiveBar(null)}
                onFocus={() => setActiveBar(index)}
                onBlur={() => setActiveBar(null)}
                onClick={() => setActiveBar(index)}
              />
            </div>
            {activeBar === index && (
              <div className="analytics-horizontal-tooltip" role="tooltip">
                <span>
                  {x}: {point.label}
                </span>
                <strong>
                  {y}: {display(point.value)} {unit}
                </strong>
              </div>
            )}
          </div>
        );
      })}
      <div className="analytics-horizontal-axis">
        <span>{display(min)}</span>
        <span>{display(max)}</span>
      </div>
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
  if (type === "kpi") {
    const current = numeric(rows[0]?.[y]);
    const previous = numeric(rows[0]?.[definition.chart.compareTo ?? ""]);
    if (current === null || previous === null)
      return (
        <div className="analytics-empty-visual">
          The query must return numeric current and previous period fields.
        </div>
      );
    const change = current - previous;
    let trend = "flat";
    if (change > 0) trend = "up";
    else if (change < 0) trend = "down";
    const changeText = `${change > 0 ? "+" : ""}${display(change)}`;
    const percentage =
      previous === 0
        ? null
        : new Intl.NumberFormat(undefined, {
            style: "percent",
            maximumFractionDigits: 1,
          }).format(change / Math.abs(previous));
    return (
      <div className={`analytics-kpi analytics-kpi--${trend}`}>
        <div className="analytics-kpi-value">
          <strong
            style={
              trend === "flat"
                ? { color: definition.styles.accentColor }
                : undefined
            }
          >
            {display(current)}
          </strong>
          {unit && <span>{unit}</span>}
        </div>
        <div className="analytics-kpi-comparison">
          <strong>
            {changeText} {unit}
          </strong>
          {percentage && <span>({percentage})</span>}
          <span>
            vs {definition.chart.comparisonLabel || "previous period"}
          </span>
        </div>
        <p>
          Previous: {display(previous)} {unit}
        </p>
      </div>
    );
  }
  if (type === "horizontal-bar")
    return (
      <HorizontalBars
        rows={rows}
        x={x}
        y={y}
        unit={unit}
        accentColor={definition.styles.accentColor}
      />
    );
  if (type === "line" || type === "area" || type === "bar")
    return (
      <Graph
        rows={rows}
        type={type}
        x={x}
        y={y}
        unit={unit}
        accentColor={definition.styles.accentColor}
        showGrid={definition.styles.showGrid}
        height={definition.styles.height}
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
