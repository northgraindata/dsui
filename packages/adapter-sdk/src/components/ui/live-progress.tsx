export function LiveProgress({
  active,
  percent,
}: {
  active: boolean;
  percent: unknown;
}) {
  const progress = typeof percent === "number" ? percent : NaN;
  if (!active || !Number.isFinite(progress)) return "-";

  return (
    <span
      className="live-progress"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${progress}% complete`}
      title={`${progress}% complete`}
    >
      <span className="live-progress-track" aria-hidden="true">
        <span
          className="live-progress-indicator"
          style={{ width: `${progress}%` }}
        />
      </span>
      <span>{progress.toFixed(1)}%</span>
    </span>
  );
}

export function LiveEta({ etaSeconds }: { etaSeconds: unknown }) {
  if (typeof etaSeconds !== "number" || !Number.isFinite(etaSeconds)) return "-";
  const rounded = Math.max(0, Math.round(etaSeconds));
  const minutes = Math.floor(rounded / 60);
  const seconds = String(rounded % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
