import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import { toneForValue } from "../../primitives/gauge";

export default Gauge;

const TONES = new Set(["info", "healthy", "warning", "unavailable", "muted"]);

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asTone(value: unknown): string | undefined {
  return typeof value === "string" && TONES.has(value) ? value : undefined;
}

/**
 * A three-quarter dial: a gap at the bottom, opening upwards.
 *
 * Drawn as a dash pattern on a full circle rather than as an arc between two
 * endpoints. An arc makes the renderer infer the centre from the chord, and for
 * a 270° sweep that inference put the centre at (0.6, 32) instead of (32, 32):
 * the ring came out lopsided, missing its right-hand side, and the fill was
 * measured against 270° while the path drew 250°. A circle plus a dash pattern
 * has one centre and one length, both taken from the radius, so the shape and
 * the fill cannot disagree.
 */
const SWEEP_DEGREES = 270;
const CENTRE = 32;

function circlePath(radius: number): string {
  return `M ${CENTRE - radius} ${CENTRE} a ${radius} ${radius} 0 1 0 ${
    radius * 2
  } 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`;
}

/**
 * Length of the circle the path traces, and the offset that leaves the gap at
 * the bottom.
 *
 * SVG measures dash offsets along the path, and the path starts at the left of
 * the circle. The gap is placed by rotating the dash pattern so it covers the
 * bottom quadrant, which is the one a dial leaves open.
 */
function circumference(radius: number): number {
  return 2 * Math.PI * radius;
}

export function Gauge({ node }: { node: PageNode }) {
  const max = asNumber(node.props.max, 100);
  const value = asNumber(node.props.value, 0);
  const showValue = node.props.showValue !== false;
  const scale =
    node.props.scale === "higher-is-worse"
      ? "higher-is-worse"
      : "higher-is-better";
  const tone = asTone(node.props.tone) ?? toneForValue(value, max, scale);
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const radius = 26;
  const total = circumference(radius);
  const visible = (SWEEP_DEGREES / 360) * total;
  const hidden = total - visible;
  // The path starts at the left of the circle and runs clockwise, so the bottom
  // quadrant begins a quarter of the way along. Rotating the pattern by that
  // puts the gap where a dial leaves it open instead of at the top.
  const offset = -total / 4;
  const label =
    typeof node.props.label === "string" && node.props.label
      ? node.props.label
      : undefined;
  return (
    <div className="ov-gauge" data-tone={tone} role="img" aria-label={label}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path
          d={circlePath(radius)}
          className="ov-gauge-track"
          strokeDasharray={`${visible} ${hidden}`}
          strokeDashoffset={offset}
        />
        <path
          d={circlePath(radius)}
          className="ov-gauge-fill"
          strokeDasharray={`${visible * share} ${total}`}
          strokeDashoffset={offset}
        />
      </svg>
      {showValue ? (
        <span className="ov-gauge-number">{Math.round(value)}</span>
      ) : null}
    </div>
  );
}
