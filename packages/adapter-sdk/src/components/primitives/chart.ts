import { z } from "zod";
import type { DataSource } from "../../resource";
import { defineComponent } from "../define";

/**
 * One point of a time series, as milliseconds since the epoch and a value.
 *
 * Milliseconds rather than a formatted string because the axis format is a
 * presentation decision the browser makes, not the one the host stores.
 */
export interface ChartPoint {
  readonly time: number;
  readonly value: number;
}

/**
 * A time window the chart can show, in seconds.
 *
 * The chart renders one of these at a time; `secs` is what the host uses to
 * choose how far back to read, so one number drives both the request and the
 * axis.
 */
export interface ChartWindow {
  readonly label: string;
  readonly secs: number;
}

/**
 * Which end of the value axis is bad.
 *
 * Explicit for the same reason as {@link GaugeScale}: a load average rising is
 * bad, throughput rising is good, and a chart that guesses will colour a
 * healthy system red.
 */
export type ChartScale = "higher-is-better" | "higher-is-worse";

/** What a chart draws. */
export type ChartKind = "line" | "area";

export interface ChartProps {
  /**
   * Where the series comes from. A chart with neither `source` nor `points`
   * renders its empty state.
   */
  source?: DataSource;
  /**
   * Points supplied directly, for a series the page already holds.
   *
   * Either `source` or `points`, never both: a chart bound to a resource is
   * re-read on that resource's refresh policy, so a caller wanting that should
   * not also pass a snapshot the host would not notice going stale.
   */
  points?: readonly ChartPoint[];
  /** Windows offered to the viewer. The first is selected. */
  windows?: readonly ChartWindow[];
  /** Line or filled area. Defaults to `"line"`. */
  kind?: ChartKind;
  /**
   * Tighten the value axis so small movements fill the height. Defaults to
   * true, because a load average moving between 3.8 and 4.2 is invisible on a
   * 0-100 axis and that is exactly the movement worth watching.
   */
  exaggerate?: boolean;
  /** Print the latest value over the chart. */
  showValue?: boolean;
  /** Accessible description of what is plotted. */
  label?: string;
  /** Which end of the axis is bad. Defaults to `"higher-is-worse"`. */
  scale?: ChartScale;
  /** Fixed value to mark, e.g. a threshold or a target. */
  referenceLine?: { value: number; label?: string };
}

export interface ChartNode {
  readonly kind: "chart";
  readonly props: ChartProps;
}

const pointSchema = z.object({
  time: z.number().finite(),
  value: z.number().finite(),
});

const windowSchema = z.object({
  label: z.string().min(1),
  secs: z.number().positive(),
});

/**
 * A chart: a time series the renderer draws.
 *
 * Declared with a `path` because drawing happens in the browser, and declared
 * with a props schema so a malformed series is rejected when the page is built
 * rather than when the canvas tries to draw it.
 */
export const Chart = defineComponent<ChartProps>({
  id: "chart",
  path: "./ui/chart",
  props: z
    .object({
      source: z.custom<DataSource>().optional(),
      points: z.array(pointSchema).optional(),
      windows: z.array(windowSchema).optional(),
      kind: z.enum(["line", "area"]).optional(),
      exaggerate: z.boolean().optional(),
      showValue: z.boolean().optional(),
      label: z.string().min(1).optional(),
      scale: z.enum(["higher-is-better", "higher-is-worse"]).optional(),
      referenceLine: z
        .object({ value: z.number(), label: z.string().optional() })
        .optional(),
    })
    .refine((value) => !(value.source && value.points), {
      message: "Chart accepts either a source or points, not both",
    }) as unknown as z.ZodTypeAny,
});
