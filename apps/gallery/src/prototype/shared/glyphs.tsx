/* One glyph per meaning, drawn on a 24 grid with one stroke. */
const glyphs = {
  upload: "M12 16V4M7 9l5-5 5 5M4 17v3h16v-3",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  folder:
    "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  folderPlus:
    "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 11v5M9.5 13.5h5",
  link: "M10 14a4 4 0 0 0 6 .5l3-3a4 4 0 0 0-5.700-5.700l-1.5 1.500M14 10a4 4 0 0 0-6-.5l-3 3a4 4 0 0 0 5.700 5.700l1.500-1.500",
  move: "M4 12h13M12 6l6 6-6 6M4 5v14",
  expand: "M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7",
  settings: "M4 7h8M16 7h4M4 17h4M12 17h8M14 4.500v5M10 14.500v5",
  keyboard: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  history: "M4 12a8 8 0 1 0 2.5-5.800M4 4v4h4M12 8v4l3 2",
  play: "M8 5.5v13l10-6.5z",
  copy: "M9 9h10v11H9zM5 15V4h10",
  down: "m7 10 5 5 5-5",
  left: "m14 6-6 6 6 6",
  right: "m10 6 6 6-6 6",
  plug: "M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4",
  bolt: "M13 3 5 14h6l-1 7 8-11h-6z",
  pause: "M9 6v12M15 6v12",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  trash: "M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13M10 11v6M14 11v6",
  retry: "M19 12a7 7 0 1 1-2.2-5.1M19 4v4h-4",
  stop: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5h5v5h-5z",
  plus: "M12 5v14M5 12h14",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  close: "M6 6l12 12M18 6 6 18",
  arrow: "M5 12h14M13 6l6 6-6 6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  alert: "M12 4 3 20h18zM12 10v4M12 17h.01",
  check: "m5 12 5 5L19 7",
  external: "M14 5h5v5M19 5l-8 8M18 14v5H5V6h5",
  python:
    "M9 4h6v5H9a3 3 0 0 0-3 3v2H4V9h8M15 20H9v-5h6a3 3 0 0 0 3-3v-2h2v5h-8",
  sql: "M5 6c0-1.1 3.1-2 7-2s7 .9 7 2-3.1 2-7 2-7-.9-7-2zM5 6v12c0 1.1 3.1 2 7 2s7-.9 7-2V6M5 12c0 1.1 3.1 2 7 2s7-.9 7-2",
  dbt: "M5 5l14 14M19 5 5 19M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  http: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  bucket: "M4 6h16l-2 14H6zM4 6c0-3 16-3 16 0",
};
export type GlyphName = keyof typeof glyphs;

export function Glyph({ name, size = 15 }: { name: GlyphName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={name === "play" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={glyphs[name]} />
    </svg>
  );
}
