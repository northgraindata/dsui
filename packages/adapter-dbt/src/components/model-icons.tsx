import type { ReactNode } from "react";
export function materializationLabel(value: string) {
  return (
    (
      {
        table: "Table",
        view: "View",
        materialized_view: "Materialized view",
        incremental: "Incremental",
        ephemeral: "Ephemeral",
      } as Record<string, string>
    )[value] ?? (value ? value.replaceAll("_", " ") : "Model")
  );
}
/** Small vector marks stay crisp at table density and share one visual grammar. */
export function ModelKindIcon({ kind }: { kind: string }) {
  let shape: ReactNode;
  if (kind === "view")
    shape = (
      <>
        <path d="M2 10s3.5-5 8-5 8 5 8 5-3.5 5-8 5-8-5-8-5Z" />
        <circle cx="10" cy="10" r="2.5" />
      </>
    );
  else if (kind === "materialized_view")
    shape = (
      <>
        <path d="M3 7V4h11l3 3v9H3V7Zm0 1h14M7 8v8" />
        <path
          d="m14 2 .8 1.7 1.7.8-1.7.8L14 7l-.8-1.7-1.7-.8 1.7-.8Z"
          fill="currentColor"
          stroke="none"
        />
      </>
    );
  else if (kind === "incremental")
    shape = (
      <>
        <path d="M10 3H3v14h14v-7M3 8h7M8 8v9M3 12h14M13 3h4v4M11 9l6-6" />
      </>
    );
  else if (kind === "ephemeral")
    shape = (
      <>
        <path d="m7 6-4 4 4 4m6-8 4 4-4 4M11 3l-2 14" />
        <path d="M2 2h2m12 0h2M2 18h2m12 0h2" opacity=".5" />
      </>
    );
  else
    shape = (
      <>
        <rect x="3" y="3" width="14" height="14" rx="2" />
        <path d="M3 8h14M8 8v9M3 12h14" />
      </>
    );
  const label = materializationLabel(kind);
  return (
    <span className="dbt-model-kind" data-kind={kind} title={label}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {shape}
      </svg>
      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {label}:{" "}
      </span>
    </span>
  );
}
