import { React } from "./react";

export function SourceIcon({ provider }: { provider: string }) {
  return (
    <span className="cr-source-icon" aria-hidden="true">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <title>{provider === "local" ? "Folder" : "Repository"}</title>
        {provider === "local" ? (
          <path d="M3 7h7l2 2h9v11H3zM3 7V4h7l2 3" />
        ) : (
          <>
            <circle cx="6" cy="5" r="2" />
            <circle cx="6" cy="19" r="2" />
            <circle cx="18" cy="6" r="2" />
            <path d="M6 7v10M18 8c0 6-12 2-12 9" />
          </>
        )}
      </svg>
    </span>
  );
}
export function ConnectionStatus({ status }: { status: string }) {
  const labels: Record<string, string> = {
    idle: "Not fetched",
    queued: "Queued",
    syncing: "Fetching",
    ready: "Up to date",
    error: "Fetch failed",
  };
  return (
    <span className="cr-status" data-status={status}>
      <i aria-hidden="true" />
      {labels[status] ?? status}
    </span>
  );
}
export function Empty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="cr-empty">
      <SourceIcon provider="local" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
