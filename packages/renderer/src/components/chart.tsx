import type {
  ChartPoint,
  ChartProps,
  ChartWindow,
  PageNode,
} from "@northgraindata/dsui-adapter-sdk";
import { componentProps } from "@northgraindata/dsui-adapter-sdk";
import { Button } from "@northgraindata/dsui-ui";
import { Liveline } from "liveline";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "../registry/component-registry";

/**
 * Points a canvas cannot show.
 *
 * A 7-day window sampled every second is 604 800 points. Drawing them all is
 * slower than it is useful, and the line ends up a solid block, so points are
 * thinned to roughly one per horizontal pixel by averaging each bucket rather
 * than dropping samples — dropping them would hide a spike that happened
 * inside the skipped span.
 */
const MAX_POINTS = 600;

function thin(points: readonly ChartPoint[]): ChartPoint[] {
  if (points.length <= MAX_POINTS) return [...points];
  const size = Math.ceil(points.length / MAX_POINTS);
  const out: ChartPoint[] = [];
  for (let i = 0; i < points.length; i += size) {
    const slice = points.slice(i, i + size);
    let sum = 0;
    for (const point of slice) sum += point.value;
    out.push({
      time: slice[Math.floor(slice.length / 2)].time,
      value: sum / slice.length,
    });
  }
  return out;
}

function asPoints(value: unknown): ChartPoint[] {
  // A bound resource answers with a window envelope, not a bare array: the
  // window's label and length travel with the samples so the chart can label
  // the axis. Reading the array directly got `{label, secs, points}` and
  // reported no readings while the server was sending them all along.
  const envelope =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { points?: unknown }).points
      : value;
  if (!Array.isArray(envelope)) return [];
  const points: ChartPoint[] = [];
  for (const entry of envelope) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as { time?: unknown; value?: unknown };
    if (
      typeof record.time === "number" &&
      Number.isFinite(record.time) &&
      typeof record.value === "number" &&
      Number.isFinite(record.value)
    )
      points.push({ time: record.time, value: record.value });
  }
  return points.sort((a, b) => a.time - b.time);
}

/**
 * Human-readable summary of a series, read by a screen reader.
 *
 * The canvas is opaque to assistive technology, so the chart ships a text
 * equivalent: the latest reading, the range shown, and the extremes. Without
 * this a chart is unreachable, not merely unstyled.
 */
function describe(
  label: string | undefined,
  points: readonly ChartPoint[],
): string {
  if (!points.length) return label ? `${label}: no data yet` : "No data yet";
  const first = points[0];
  const last = points.at(-1)!;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const trend =
    last.value > first.value
      ? "rising"
      : last.value < first.value
        ? "falling"
        : "steady";
  const name = label ? `${label}: ` : "";
  return (
    `${name}${points.length} readings. ` +
    `Latest ${formatValue(last.value)}, ` +
    `low ${formatValue(min)}, high ${formatValue(max)}, ` +
    `${trend} across the window.`
  );
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

function formatTime(ms: number, spanMs: number): string {
  const date = new Date(ms);
  const time = date.toISOString().slice(11, 16);
  return spanMs > 86_400_000
    ? `${date.toISOString().slice(5, 10)} ${time}`
    : time;
}

function windowSpan(windows: readonly ChartWindow[] | undefined): number {
  if (!windows?.length) return 300_000;
  return windows[0].secs * 1000;
}

export function Chart({ client, node }: ComponentProps) {
  const props = componentProps<ChartProps>(node as PageNode);
  const [points, setPoints] = useState<ChartPoint[]>(() =>
    asPoints(props?.points),
  );
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const latest = useRef<ChartPoint | undefined>(props?.points?.at(-1));
  const windows = props?.windows ?? [];

  /**
   * The resource read, retargeted at the window on screen.
   *
   * A bound resource carries the window in its input, so selecting a different
   * one has to change the request. Passing `source` through untouched meant
   * every window button redrew the same slice of data under a different label:
   * choosing 7d showed the last hour and said 7d on it. Rebuilding the object
   * also gives the effect below a new identity, which is what re-runs it.
   */
  const source = useMemo(() => {
    const bound = props?.source;
    if (!bound) return undefined;
    const window = windows[selected];
    if (!window) return bound;
    const input =
      bound.input && typeof bound.input === "object"
        ? { ...(bound.input as Record<string, unknown>), window: window.label }
        : { window: window.label };
    return { ...bound, input };
  }, [props?.source, windows, selected]);

  // A bound chart re-reads on the resource's own refresh policy, the same way
  // a table or a meter does. Pausing stops the subscription rather than only
  // the drawing: keeping it would poll the host for readings nobody is looking
  // at. The last readings stay on screen, and resuming refetches, so a pause
  // never leaves a stale series frozen in place.
  useEffect(() => {
    if (!source) return;
    if (source.refresh?.kind === "poll" && client.watchResource) {
      return client.watchResource(source, (result) => {
        if (paused) return;
        const next = asPoints(result);
        if (next.length) latest.current = next.at(-1);
        setPoints(next);
      });
    }
    let active = true;
    client
      .executeResource(source)
      .then((result) => {
        if (!active) return;
        const next = asPoints(result);
        if (next.length) latest.current = next.at(-1);
        setPoints(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [client, source, paused]);

  const spanMs = windowSpan(windows[selected] ? [windows[selected]] : windows);

  const data = useMemo(
    () =>
      thin(points).map((point) => ({
        time: Math.round(point.time / 1000),
        value: point.value,
      })),
    [points],
  );

  if (!props) return null;

  if (!data.length)
    return (
      <p className="text-[12px] text-secondary">
        {props.label ? `${props.label}: ` : ""}
        No readings in this window yet.
      </p>
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {/* Only the transport control lives here. The window buttons are
            rendered by Liveline under the chart, so a second row of them was
            two independent controls for one setting: the copy in this row moved
            a local index while Liveline kept its own, and only one of the two
            changed what was drawn. */}
        <Button
          variant="ghost"
          size="small"
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? "Resume" : "Pause"}
        </Button>
        {paused && <span className="text-[12px] text-muted">Paused</span>}
      </div>
      <div
        style={{ height: 200 }}
        role="img"
        aria-label={describe(props.label, points)}
      >
        <Liveline
          data={data}
          value={latest.current?.value ?? data.at(-1)!.value}
          window={spanMs / 1000}
          windows={windows.map((window) => ({
            label: window.label,
            secs: window.secs,
          }))}
          onWindowChange={(secs) => {
            const index = windows.findIndex((window) => window.secs === secs);
            if (index >= 0) setSelected(index);
          }}
          windowStyle="rounded"
          fill={props.kind === "area"}
          showValue={props.showValue}
          // Off unless a caller asks for it. Exaggeration squeezes the scale
          // onto the data's own range with almost no margin, which turns every
          // sample-to-sample wobble into a full-height spike: a load average
          // read once a second came out looking like an ECG rather than a line.
          // A wider margin is the difference between a trend and noise.
          exaggerate={props.exaggerate ?? false}
          lineWidth={props.lineWidth ?? 2}
          paused={paused}
          formatValue={formatValue}
          formatTime={(seconds) => formatTime(seconds * 1000, spanMs)}
          {...(props.referenceLine
            ? {
                referenceLine: {
                  value: props.referenceLine.value,
                  ...(props.referenceLine.label
                    ? { label: props.referenceLine.label }
                    : {}),
                },
              }
            : {})}
        />
      </div>
    </div>
  );
}
