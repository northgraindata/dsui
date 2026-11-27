import type { RunStatus, RunStep, RunSummary } from "../contract";
import { React } from "./react";

const STATUS_LABELS: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  valid: "Valid",
  partial: "Partial check",
  issues: "Issues",
  incomplete: "Incomplete",
};

export const isActive = (run: RunSummary | null | undefined) =>
  run?.status === "queued" || run?.status === "running";

export function statusLabel(run: RunSummary | null) {
  if (!run) return "Never checked";
  return run.status === "issues"
    ? `Issues · ${run.problemCount}`
    : STATUS_LABELS[run.status];
}

export function StatusBadge({ run }: { run: RunSummary | null }) {
  return (
    <span className="dx-badge" data-status={run?.status ?? "none"}>
      <i />
      {statusLabel(run)}
    </span>
  );
}

export function when(value: string | null, timeZone?: string) {
  return value
    ? new Date(value).toLocaleString(
        undefined,
        timeZone
          ? {
              timeZone,
              timeZoneName: "short",
            }
          : undefined,
      )
    : "—";
}

export function duration(run: RunSummary) {
  if (!run.startedAt || !run.finishedAt) return "—";
  const seconds = Math.max(
    0,
    Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000),
  );
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

const STEP_ICONS: Record<RunStep["state"], string> = {
  pending: "○",
  running: "◐",
  ok: "✓",
  skipped: "–",
  "needs-confirmation": "!",
  failed: "✕",
};

export function Steps({ steps }: { steps: readonly RunStep[] }) {
  return (
    <ol className="dx-steps">
      {steps.map((step) => (
        <li key={step.id} data-state={step.state}>
          <b aria-hidden="true">{STEP_ICONS[step.state]}</b>
          <span>
            {step.label}
            <small>
              {step.state.replace("-", " ")}
              {step.message ? ` · ${step.message}` : ""}
            </small>
          </span>
        </li>
      ))}
    </ol>
  );
}
