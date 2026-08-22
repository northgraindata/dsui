/** Bundled brand glyphs for built-in adapters. Configured logos take precedence. */
function glyphProps() {
  return {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
}

export function TrinoMark() {
  return (
    <svg {...glyphProps()} aria-hidden="true">
      <circle cx="9" cy="15" r="5.5" />
      <circle cx="15" cy="9" r="5.5" opacity="0.55" />
    </svg>
  );
}

export function KafkaMark() {
  return (
    <svg {...glyphProps()} aria-hidden="true">
      <circle cx="7.5" cy="12" r="3" />
      <circle cx="17" cy="6" r="1.8" />
      <circle cx="17" cy="12" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
      <path d="m10 10.2 5.2-3.4M10.7 12h4.5M10 13.8l5.2 3.4" />
    </svg>
  );
}

export function S3Mark() {
  return (
    <svg {...glyphProps()} aria-hidden="true">
      <path d="M5 5h14l-1.5 11.8a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8Z" />
      <path d="M12 8.5v6M9.6 12.1l2.4 2.4 2.4-2.4" />
    </svg>
  );
}

export function BrandGlyph({ adapter }: { adapter: string }) {
  if (adapter === "trino") return <TrinoMark />;
  if (adapter === "kafka") return <KafkaMark />;
  if (adapter === "s3") return <S3Mark />;
  return null;
}
