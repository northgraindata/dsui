import type { StripBucket } from "./contract";
import { React } from "./react";

/**
 * One bar per hour for the last week, worst status first.
 *
 * Grey bars mean nothing was measured that hour, not that the service was
 * fine, so a stopped DSUI never reads as uptime.
 */
export function HistoryStrip({
  buckets,
  availability,
}: {
  buckets: readonly StripBucket[];
  availability: number | null;
}) {
  const caption = React.useMemo(() => {
    if (availability === null) return "Waiting for history";
    const floored = Math.floor(availability * 100) / 100;
    return `${floored >= 100 ? "100" : floored.toFixed(2)}% uptime`;
  }, [availability]);
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
