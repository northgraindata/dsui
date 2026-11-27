/*
 * One table decides how every file looks and how it previews. Types are told
 * apart by a pictogram and a colour, never by letters standing in for a logo.
 */
export type PreviewKind =
  | "table"
  | "parquet"
  | "records"
  | "json"
  | "code"
  | "text"
  | "log"
  | "markdown"
  | "notebook"
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "archive"
  | "binary";

interface FileType {
  label: string;
  preview: PreviewKind;
  colour: string;
  glyph: keyof typeof pictograms;
}

const page = "M6 3h8l5 5v13H6zM14 3v5h5";
const pictograms = {
  folder:
    "M3 7a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  grid: "M4 5h16v14H4zM4 10h16M4 14.5h16M10 5v14",
  columns: "M5 5h3.500v14H5zM10.200 5h3.600v14h-3.600zM15.500 5H19v14h-3.500z",
  braces: "M9 4c-3 0-1 6-4 8 3 2 1 8 4 8M15 4c3 0 1 6 4 8-3 2-1 8-4 8",
  rows: "M4 6h2M9 6h11M4 12h2M9 12h11M4 18h2M9 18h11",
  code: "M8.500 7 3.500 12l5 5M15.500 7l5 5-5 5M13.500 5l-3 14",
  database:
    "M5 6c0-1.600 3.100-2.700 7-2.700S19 4.400 19 6s-3.100 2.700-7 2.700S5 7.600 5 6zM5 6v12c0 1.600 3.100 2.700 7 2.700s7-1.100 7-2.700V6M5 12c0 1.600 3.100 2.700 7 2.700s7-1.100 7-2.700",
  sliders: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  lines: `${page}M9 12h7M9 15.500h7M9 8.500h2`,
  terminal: "M4 5h16v14H4zM7.500 9.500 10 12l-2.500 2.500M12.500 15H16",
  heading: "M4 6v12M12 6v12M4 12h8M17 10v8M14.500 15.500 17 18l2.500-2.500",
  book: "M5 4h13v16H5zM5 4v16M9 8h6M9 12h6",
  picture: "M4 5h16v14H4zM4 16l5-5 4 4 2.500-2.500L20 17M15.500 9.500h.01",
  document: `${page}M9 13h6v4H9z`,
  film: "M4 5h16v14H4zM8 5v14M16 5v14M4 9.500h4M4 14.500h4M16 9.500h4M16 14.500h4",
  wave: "M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2",
  package: "M12 3 20 7v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10M8 5l8 4",
  unknown: `${page}M10.500 12a1.700 1.700 0 1 1 2.300 1.600c-.600.300-.800.700-.800 1.400M12 18h.01`,
};

const type = (
  label: string,
  preview: PreviewKind,
  colour: string,
  glyph: FileType["glyph"],
): FileType => ({ label, preview, colour, glyph });

const csv = type("CSV table", "table", "#3ecf8e", "grid");
const yaml = type("YAML", "code", "#f2a65a", "sliders");
const archive = type("Archive", "archive", "#c8a97e", "package");
const image = type("Image", "image", "#e879c6", "picture");
const video = type("Video", "video", "#ff6b81", "film");
const audio = type("Audio", "audio", "#ff9f68", "wave");

const byExtension: Record<string, FileType> = {
  csv,
  tsv: type("TSV table", "table", "#3ecf8e", "grid"),
  parquet: type("Parquet", "parquet", "#7c8cff", "columns"),
  orc: type("ORC", "binary", "#7c8cff", "columns"),
  avro: type("Avro", "binary", "#7c8cff", "columns"),
  json: type("JSON", "json", "#f5d060", "braces"),
  jsonl: type("JSON Lines", "records", "#f5d060", "rows"),
  ndjson: type("JSON Lines", "records", "#f5d060", "rows"),
  py: type("Python", "code", "#4aa8ff", "code"),
  sql: type("SQL", "code", "#35c7e8", "database"),
  sh: type("Shell script", "code", "#9fb0cc", "terminal"),
  js: type("JavaScript", "code", "#f5d060", "code"),
  ts: type("TypeScript", "code", "#4aa8ff", "code"),
  yaml,
  yml: yaml,
  toml: type("TOML", "code", "#f2a65a", "sliders"),
  ini: type("Config", "code", "#f2a65a", "sliders"),
  xml: type("XML", "code", "#f2a65a", "code"),
  html: type("HTML", "code", "#f2a65a", "code"),
  txt: type("Text", "text", "#b0c1df", "lines"),
  log: type("Log", "log", "#b0c1df", "terminal"),
  md: type("Markdown", "markdown", "#8fd7ff", "heading"),
  ipynb: type("Notebook", "notebook", "#ff9f43", "book"),
  png: image,
  jpg: image,
  jpeg: image,
  gif: image,
  webp: image,
  svg: image,
  pdf: type("PDF", "pdf", "#ff6b6b", "document"),
  mp4: video,
  webm: video,
  mov: video,
  mp3: audio,
  wav: audio,
  zip: archive,
  tar: archive,
  tgz: archive,
  gz: archive,
  bz2: archive,
  zst: archive,
};

const folder = type("Folder", "binary", "#5b9dff", "folder");
const unknown = type("File", "binary", "#8399bd", "unknown");

/** `events.jsonl.gz` is compressed JSON Lines, not just an archive. */
export function fileType(name: string): FileType & { compressed?: boolean } {
  if (name.endsWith("/")) return folder;
  const parts = name.toLowerCase().split("/").at(-1)?.split(".") ?? [];
  const last = parts.length > 1 ? parts.at(-1) : undefined;
  if ((last === "gz" || last === "zst") && parts.length > 2) {
    const inner = byExtension[parts.at(-2) ?? ""];
    if (inner)
      return {
        ...inner,
        label: `${inner.label}, compressed`,
        compressed: true,
      };
  }
  // Spark and friends write `part-0000.snappy.parquet`.
  return byExtension[last ?? ""] ?? unknown;
}

export function FileIcon({ name, size = 28 }: { name: string; size?: number }) {
  const item = fileType(name);
  return (
    <span
      className="s3-file-icon"
      data-folder={name.endsWith("/") || undefined}
      style={
        {
          "--file": item.colour,
          width: size,
          height: size,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width={size * 0.64}
        height={size * 0.64}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={pictograms[item.glyph]} />
      </svg>
    </span>
  );
}
