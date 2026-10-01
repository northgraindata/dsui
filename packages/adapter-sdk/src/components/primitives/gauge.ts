import { defineComponent } from "../define";

/**
 * A radial gauge showing one value against a maximum.
 *
 * Used where a single reading must be comparable at a glance across many
 * items — a service card showing its health score next to a dozen others —
 * which is what a linear bar cannot do without eating a row of vertical space
 * per item. The number is the only text: a label would defeat the purpose, so
 * callers that need context render it beside the gauge rather than inside it.
 */
export type GaugeTone =
  | "info"
  | "healthy"
  | "warning"
  | "unavailable"
  | "muted";

/**
 * Which end of the scale is bad.
 *
 * This has to be explicit. A health score of 100 is good while a disk at 100%
 * is bad, and a gauge that guesses the polarity will colour a healthy service
 * red or a full disk green. Callers state which they mean instead of relying
 * on a default that is only right half the time.
 */
export type GaugeScale = "higher-is-better" | "higher-is-worse";

export interface GaugeProps {
  /** Current value, in the same unit as `max`. */
  value: number;
  /** Upper bound of the scale. Defaults to 100. */
  max?: number;
  /** Colour band. Omit to let the renderer derive one from `scale`. */
  tone?: GaugeTone;
  /** Which end of the scale is bad. Defaults to `"higher-is-better"`. */
  scale?: GaugeScale;
  /** Whether to print the value inside the ring. Defaults to true. */
  showValue?: boolean;
  /** Accessible description; not drawn. */
  label?: string;
}

export interface GaugeNode {
  readonly kind: "gauge";
  readonly props: GaugeProps;
}

export const Gauge = defineComponent<GaugeProps, GaugeNode>({
  id: "gauge",
  render: (props) => {
    const value = props.value;
    if (!Number.isFinite(value))
      throw new Error("Gauge value must be a finite number");
    const max = props.max ?? 100;
    if (!Number.isFinite(max) || max <= 0)
      throw new Error("Gauge max must be a positive number");
    return {
      kind: "gauge",
      props: {
        value,
        max,
        ...(props.tone ? { tone: props.tone } : {}),
        ...(props.scale ? { scale: props.scale } : {}),
        ...(props.showValue === false ? { showValue: false } : {}),
        ...(props.label ? { label: props.label } : {}),
      },
    };
  },
});

/**
 * Derives a tone from a reading on a 0-`max` scale.
 *
 * Thresholds are expressed as a share of "how bad", derived by inverting the
 * reading for a higher-is-better scale. The default bands differ per scale
 * because the two scales are not the same measure: on a score, 80 is a healthy
 * pass and 50 is a serious problem, while for a percentage-full meter 80 is
 * already worth a warning and 90 is an emergency.
 *
 * Exported so callers colouring surrounding UI can match the ring exactly
 * instead of re-deriving thresholds and drifting from them.
 */
export function toneForValue(
  value: number,
  max = 100,
  scale: GaugeScale = "higher-is-better",
  thresholds?: { warning: number; critical: number },
): GaugeTone {
  const share = max === 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const bad = scale === "higher-is-worse" ? share : 1 - share;
  const { warning, critical } =
    thresholds ??
    (scale === "higher-is-worse"
      ? { warning: 0.8, critical: 0.9 }
      : { warning: 0.2, critical: 0.5 });
  if (bad >= critical) return "unavailable";
  if (bad >= warning) return "warning";
  return "healthy";
}
