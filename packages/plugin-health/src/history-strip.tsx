import { bucketHistory, type HistoryPoint } from "./history-model";
import { React } from "./react";

export function HistoryStrip({ points }: { points: readonly HistoryPoint[] }) {
  const buckets = React.useMemo(
    () => bucketHistory(points, Date.now()),
    [points],
  );
  const measured = points.filter((point) => point.health !== "unknown");
  const healthy = measured.filter((point) => point.health === "healthy").length;
  const caption = measured.length
    ? `${Math.round((healthy / measured.length) * 100)}% healthy checks`
    : "Waiting for history";
  return (
    <div className="health-history">
      <svg
        viewBox={`0 0 ${buckets.length * 4} 24`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Last week: ${caption}. Grey bars have no measurement.`}
      >
        {buckets.map((bucket, index) => (
          <rect
            key={bucket.time}
            x={index * 4}
            y={2}
            width={2.5}
            height={20}
            rx={1}
            data-health={bucket.health ?? "missing"}
          >
            <title>
              {new Date(bucket.time).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              : {bucket.health ?? "No measurement"}
              {bucket.samples ? ` · ${bucket.samples} checks` : ""}
              {bucket.latencyMs !== null
                ? ` · ${Math.round(bucket.latencyMs)} ms average`
                : ""}
            </title>
          </rect>
        ))}
      </svg>
      <span>{caption}</span>
    </div>
  );
}
