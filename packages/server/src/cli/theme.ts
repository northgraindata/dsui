/**
 * Terminal styling for the DSUI CLI, with no third-party dependency.
 *
 * Detection is per stream on purpose. `Bun.color` infers support from stdout
 * alone, so a theme built once would keep colouring stderr after it had been
 * redirected: `dsui serve > boot.log` should stay readable, and
 * `dsui serve 2> boot.log` should contain no escape bytes at all.
 */

/** The brand palette, mirroring the status tokens in packages/ui. */
const HEX = {
  brand: "#3b82f6",
  brandSoft: "#93c5fd",
  healthy: "#50c878",
  warning: "#edbd54",
  danger: "#ff547f",
  unknown: "#8491aa",
  muted: "#8399bd",
  faint: "#475569",
} as const;

/**
 * Basic SGR codes, used below 256 colours. Bun's hex to 16-colour downsample
 * maps healthy, warning and danger onto three identical escapes, which would
 * leave a 16-colour terminal unable to tell the states apart at all. These
 * codes stay distinct at every colour depth.
 */
const SGR = {
  brand: "34",
  brandSoft: "94",
  healthy: "32",
  warning: "33",
  danger: "31",
  unknown: "90",
  muted: "37",
  faint: "90",
} as const;

const RESET = "\u001b[0m";

type Token = keyof typeof HEX;

export type ColorDepth = 0 | 16 | 256 | 16_000_000;

export interface Theme {
  /** False when the stream is redirected, dumb, or NO_COLOR is set. */
  readonly color: boolean;
  brand(text: string): string;
  brandSoft(text: string): string;
  healthy(text: string): string;
  warning(text: string): string;
  danger(text: string): string;
  unknown(text: string): string;
  muted(text: string): string;
  faint(text: string): string;
  dim(text: string): string;
  bold(text: string): string;
  /** Pads to a visual width, ignoring escape sequences. */
  pad(text: string, width: number): string;
}

function depthOf(stream: "stdout" | "stderr"): ColorDepth {
  if (process[stream].isTTY !== true) return 0;
  if (process.env.TERM === "dumb") return 0;
  if (process.env.NO_COLOR) return 0;
  if (process.env.FORCE_COLOR) return 16_000_000;
  if (/256/.test(process.env.TERM ?? "")) return 256;
  const colorterm = process.env.COLORTERM ?? "";
  if (colorterm === "truecolor" || colorterm === "24bit") return 16_000_000;
  return 16;
}

export function createTheme(stream: "stdout" | "stderr" = "stdout"): Theme {
  const depth = depthOf(stream);
  const hexFormat = depth >= 16_000_000 ? "ansi-16m" : "ansi-256";

  const paint =
    (token: Token) =>
    (text: string): string => {
      if (depth === 0) return text;
      const open =
        depth < 256
          ? `\u001b[${SGR[token]}m`
          : (Bun.color(HEX[token], hexFormat) ?? "");
      return open ? `${open}${text}${RESET}` : text;
    };

  const attribute =
    (code: string) =>
    (text: string): string => {
      if (depth === 0) return text;
      const open =
        Bun.color(code, hexFormat) ?? `\u001b[${code === "dim" ? 2 : 1}m`;
      return `${open}${text}${RESET}`;
    };

  return {
    color: depth > 0,
    brand: paint("brand"),
    brandSoft: paint("brandSoft"),
    healthy: paint("healthy"),
    warning: paint("warning"),
    danger: paint("danger"),
    unknown: paint("unknown"),
    muted: paint("muted"),
    faint: paint("faint"),
    dim: attribute("dim"),
    bold: attribute("bold"),
    pad: (text, width) =>
      text + " ".repeat(Math.max(0, width - Bun.stringWidth(text))),
  };
}
