import { useMemo, useState } from "react";
import type {
  CartesianBlock,
  GaugeBlock,
  PieBlock,
} from "../dashboard-model.js";
import {
  allWholeDays,
  arcPath,
  formatCompact,
  formatNumber,
  formatTime,
  niceMax,
  seriesColor,
  ticks,
  truncate,
} from "./chart-utils.js";

const WIDTH = 640;
const HEIGHT = 260;
const MARGIN = { top: 12, right: 28, bottom: 34, left: 52 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const BAR_LABEL_GUTTER = 100;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

const axisText = {
  fill: "var(--color-muted)",
  fontSize: 10.5,
  fontFamily: "var(--font-ui)",
} as const;

function Legend({ names }: { names: readonly string[] }) {
  if (names.length < 2) return null;
  return (
    <ul style={legendStyle}>
      {names.map((name, index) => (
        <li key={name} style={legendItemStyle}>
          <i
            aria-hidden="true"
            style={{ ...swatchStyle, background: seriesColor(index) }}
          />
          {name}
        </li>
      ))}
    </ul>
  );
}

const legendStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "4px 14px",
  listStyle: "none",
  margin: "6px 0 0",
  padding: 0,
} as const;
const legendItemStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  color: "var(--color-secondary)",
} as const;
const swatchStyle = { width: 8, height: 8, borderRadius: 2 } as const;
const readoutStyle = {
  minHeight: 16,
  margin: "0 0 4px",
  fontSize: 11,
  color: "var(--color-secondary)",
  fontVariantNumeric: "tabular-nums",
} as const;

function xLabel(block: CartesianBlock, value: string | number): string {
  return block.xType === "time" && typeof value === "number"
    ? formatTime(value, allWholeDays(block.x))
    : String(value);
}

function seriesMax(block: CartesianBlock): number {
  if (block.stacked && block.kind === "bar") {
    return Math.max(
      0,
      ...block.x.map((_, at) =>
        block.series.reduce((sum, item) => sum + (item.values[at] ?? 0), 0),
      ),
    );
  }
  return Math.max(
    0,
    ...block.series.flatMap((item) => item.values.map((v) => v ?? 0)),
  );
}

function YAxis({
  max,
  horizontalGrid = true,
}: {
  max: number;
  horizontalGrid?: boolean;
}) {
  return (
    <g>
      {ticks(max).map((tick) => {
        const y = MARGIN.top + PLOT_HEIGHT - (tick / max) * PLOT_HEIGHT;
        return (
          <g key={tick}>
            {horizontalGrid ? (
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
              />
            ) : null}
            <text
              x={MARGIN.left - 8}
              y={y + 3.5}
              textAnchor="end"
              {...axisText}
            >
              {formatCompact(tick)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Evenly thins labels so a long axis stays legible. */
function labelStride(count: number, room: number): number {
  return Math.max(1, Math.ceil(count / room));
}

export function LineChart({ block }: { block: CartesianBlock }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(seriesMax(block));
  const geometry = useMemo(() => {
    const numeric = block.x.map((value) => Number(value));
    const timed = block.xType === "time";
    const min = timed ? Math.min(...numeric) : 0;
    const span = timed
      ? Math.max(1, Math.max(...numeric) - min)
      : Math.max(1, block.x.length - 1);
    return block.x.map((_, at) => {
      const position = timed ? ((numeric[at] ?? 0) - min) / span : at / span;
      return MARGIN.left + position * PLOT_WIDTH;
    });
  }, [block]);
  const yFor = (value: number) =>
    MARGIN.top + PLOT_HEIGHT - (value / max) * PLOT_HEIGHT;
  const stride = labelStride(block.x.length, 7);

  const nearest = (clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * WIDTH;
    let best = 0;
    let distance = Number.POSITIVE_INFINITY;
    geometry.forEach((position, at) => {
      const gap = Math.abs(position - x);
      if (gap < distance) {
        distance = gap;
        best = at;
      }
    });
    return best;
  };

  const shown = hover ?? block.x.length - 1;
  return (
    <div>
      <p style={readoutStyle}>
        {block.x[shown] !== undefined ? (
          <>
            <strong style={{ color: "var(--color-primary)" }}>
              {xLabel(block, block.x[shown] as string | number)}
            </strong>
            {block.series.map((item) => (
              <span key={item.name}>
                {"  "}
                {block.series.length > 1 ? `${item.name} ` : ""}
                {item.values[shown] === null || item.values[shown] === undefined
                  ? "-"
                  : formatNumber(item.values[shown] as number)}
              </span>
            ))}
          </>
        ) : null}
      </p>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={block.title || "Line chart"}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          overflow: "visible",
        }}
        onMouseMove={(event) =>
          setHover(
            nearest(event.clientX, event.currentTarget.getBoundingClientRect()),
          )
        }
        onMouseLeave={() => setHover(null)}
      >
        <YAxis max={max} />
        {block.x.map((value, at) =>
          at % stride === 0 ? (
            <text
              key={String(value)}
              x={geometry[at]}
              y={HEIGHT - 12}
              textAnchor="middle"
              {...axisText}
            >
              {truncate(xLabel(block, value), 12)}
            </text>
          ) : null,
        )}
        {block.series.map((item, index) => {
          const segments: string[] = [];
          let pen = false;
          item.values.forEach((value, at) => {
            if (value === null) {
              pen = false;
              return;
            }
            segments.push(
              `${pen ? "L" : "M"} ${geometry[at]?.toFixed(2)} ${yFor(value).toFixed(2)}`,
            );
            pen = true;
          });
          return (
            <g key={item.name}>
              <path
                d={segments.join(" ")}
                fill="none"
                stroke={seriesColor(index)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {block.x.length <= 40
                ? item.values.map((value, at) =>
                    value === null ? null : (
                      <circle
                        key={`${item.name}-${block.x[at]}`}
                        cx={geometry[at]}
                        cy={yFor(value)}
                        r={hover === at ? 4 : 2.2}
                        fill={seriesColor(index)}
                      />
                    ),
                  )
                : null}
            </g>
          );
        })}
        {hover !== null ? (
          <line
            x1={geometry[hover]}
            x2={geometry[hover]}
            y1={MARGIN.top}
            y2={MARGIN.top + PLOT_HEIGHT}
            stroke="var(--color-border-strong)"
          />
        ) : null}
      </svg>
      <Legend names={block.series.map((item) => item.name)} />
    </div>
  );
}

export function BarChart({ block }: { block: CartesianBlock }) {
  const max = niceMax(seriesMax(block));
  const count = block.x.length;
  const horizontal = block.orientation === "horizontal";
  const left = horizontal ? BAR_LABEL_GUTTER : MARGIN.left;
  const plotWidth = WIDTH - left - MARGIN.right;
  const labels = block.x.map((value) => xLabel(block, value));
  const stride = labelStride(count, horizontal ? 12 : 8);
  const band = (horizontal ? PLOT_HEIGHT : plotWidth) / Math.max(1, count);
  const inner = Math.min(band * 0.7, 44);
  const groupWidth = block.stacked
    ? inner
    : inner / Math.max(1, block.series.length);

  const bars = block.x.flatMap((_, at) => {
    let offset = 0;
    return block.series.flatMap((item, seriesIndex) => {
      const value = item.values[at];
      if (value === null || value === undefined) return [];
      const length = (value / max) * (horizontal ? plotWidth : PLOT_HEIGHT);
      const centre = (at + 0.5) * band;
      const lane = block.stacked
        ? 0
        : (seriesIndex - (block.series.length - 1) / 2) * groupWidth;
      const start = block.stacked ? offset : 0;
      if (block.stacked) offset += length;
      const across = centre + lane - groupWidth / 2;
      return [
        {
          key: `${at}-${item.name}`,
          at,
          color: seriesColor(seriesIndex),
          title: `${labels[at]} · ${item.name}: ${formatNumber(value)}`,
          ...(horizontal
            ? {
                x: left + start,
                y: MARGIN.top + across,
                width: length,
                height: groupWidth,
              }
            : {
                x: left + across,
                y: MARGIN.top + PLOT_HEIGHT - start - length,
                width: groupWidth,
                height: length,
              }),
        },
      ];
    });
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={block.title || "Bar chart"}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          overflow: "visible",
        }}
      >
        {horizontal ? (
          <g>
            {ticks(max).map((tick) => {
              const x = left + (tick / max) * plotWidth;
              return (
                <g key={tick}>
                  <line
                    x1={x}
                    x2={x}
                    y1={MARGIN.top}
                    y2={MARGIN.top + PLOT_HEIGHT}
                    stroke="var(--color-border)"
                  />
                  <text x={x} y={HEIGHT - 12} textAnchor="middle" {...axisText}>
                    {formatCompact(tick)}
                  </text>
                </g>
              );
            })}
            {labels.map((label, at) =>
              at % stride === 0 ? (
                <text
                  key={String(block.x[at])}
                  x={left - 8}
                  y={MARGIN.top + (at + 0.5) * band + 3.5}
                  textAnchor="end"
                  {...axisText}
                >
                  {truncate(label, 14)}
                </text>
              ) : null,
            )}
          </g>
        ) : (
          <g>
            <YAxis max={max} />
            {labels.map((label, at) =>
              at % stride === 0 ? (
                <text
                  key={String(block.x[at])}
                  x={left + (at + 0.5) * band}
                  y={HEIGHT - 12}
                  textAnchor="middle"
                  {...axisText}
                >
                  {truncate(label, 12)}
                </text>
              ) : null,
            )}
          </g>
        )}
        {bars.map((bar) => (
          <rect
            key={bar.key}
            x={bar.x}
            y={bar.y}
            width={Math.max(0, bar.width)}
            height={Math.max(0, bar.height)}
            rx={2}
            fill={bar.color}
          >
            <title>{bar.title}</title>
          </rect>
        ))}
      </svg>
      <Legend names={block.series.map((item) => item.name)} />
    </div>
  );
}

export function PieChart({ block }: { block: PieBlock }) {
  const total = block.slices.reduce((sum, slice) => sum + slice.value, 0);
  const radius = 92;
  let angle = -Math.PI / 2;
  const arcs = block.slices.map((slice, index) => {
    const sweep = total === 0 ? 0 : (slice.value / total) * Math.PI * 2;
    const start = angle;
    angle += sweep;
    return { slice, index, start, end: angle };
  });
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 20,
      }}
    >
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={block.title || "Pie chart"}
        style={{ width: 200, height: 200, flex: "none" }}
      >
        {arcs.map(({ slice, index, start, end }) => (
          <path
            key={slice.name}
            d={arcPath(
              100,
              100,
              radius,
              block.donut ? radius * 0.6 : 0,
              start,
              end,
            )}
            fill={seriesColor(index)}
            stroke="var(--color-surface)"
            strokeWidth={1.5}
          >
            <title>{`${slice.name}: ${formatNumber(slice.value)}`}</title>
          </path>
        ))}
        {block.donut ? (
          <text
            x={100}
            y={105}
            textAnchor="middle"
            fill="var(--color-primary)"
            fontSize={18}
            fontFamily="var(--font-ui)"
          >
            {formatCompact(total)}
          </text>
        ) : null}
      </svg>
      <ul style={{ ...legendStyle, flexDirection: "column", margin: 0 }}>
        {block.slices.map((slice, index) => (
          <li key={slice.name} style={legendItemStyle}>
            <i
              aria-hidden="true"
              style={{ ...swatchStyle, background: seriesColor(index) }}
            />
            {slice.name}
            <span style={{ color: "var(--color-muted)" }}>
              {formatNumber(slice.value)}
              {total > 0
                ? ` (${Math.round((slice.value / total) * 100)}%)`
                : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GaugeChart({ block }: { block: GaugeBlock }) {
  const min = Math.min(...block.ranges.map((range) => range.from));
  const max = Math.max(...block.ranges.map((range) => range.to));
  const span = Math.max(1e-9, max - min);
  const fraction = Math.min(1, Math.max(0, (block.value - min) / span));
  const toAngle = (value: number) => Math.PI + ((value - min) / span) * Math.PI;
  const banded = block.ranges.length > 1;
  const tones = [
    "var(--color-unavailable)",
    "var(--color-warning)",
    "var(--color-healthy)",
  ];
  return (
    <svg
      viewBox="0 0 200 132"
      role="img"
      aria-label={`${block.title || "Gauge"}: ${formatNumber(block.value)}`}
      style={{ width: "100%", maxWidth: 260, height: "auto", display: "block" }}
    >
      {banded ? (
        block.ranges.map((range, index) => (
          <path
            key={`${range.from}-${range.to}`}
            d={arcPath(
              100,
              100,
              88,
              66,
              toAngle(range.from),
              toAngle(range.to),
            )}
            fill={tones[Math.min(index, tones.length - 1)]}
            opacity={0.35}
          />
        ))
      ) : (
        <path
          d={arcPath(100, 100, 88, 66, Math.PI, Math.PI * 2)}
          fill="var(--color-border-strong)"
        />
      )}
      {fraction > 0 ? (
        <path
          d={arcPath(100, 100, 88, 66, Math.PI, Math.PI + fraction * Math.PI)}
          fill="var(--color-accent)"
        />
      ) : null}
      <text
        x={100}
        y={96}
        textAnchor="middle"
        fill="var(--color-primary)"
        fontSize={24}
        fontWeight={600}
        fontFamily="var(--font-ui)"
      >
        {formatNumber(block.value)}
      </text>
      <text x={12} y={122} {...axisText}>
        {formatCompact(min)}
      </text>
      <text x={188} y={122} textAnchor="end" {...axisText}>
        {formatCompact(max)}
      </text>
    </svg>
  );
}
