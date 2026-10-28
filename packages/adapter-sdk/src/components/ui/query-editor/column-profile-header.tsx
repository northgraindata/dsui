import { WorkbenchIcon } from "../icons";
import type { ColumnProfile, QuerySortDirection } from "./column-profile";

const histogramSlots = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

const kindIcon = {
  number: "hash",
  date: "calendar",
  boolean: "check",
  json: "braces",
  text: "text",
  unknown: "file",
} as const;

function sortControl(direction?: QuerySortDirection) {
  if (direction === "asc")
    return { label: "Sort descending", icon: "sort-up" } as const;
  if (direction === "desc")
    return { label: "Restore original order", icon: "sort-down" } as const;
  return { label: "Sort ascending", icon: "sort" } as const;
}

export function ColumnProfileHeader({
  profile,
  sortDirection,
  onSort,
}: {
  profile: ColumnProfile;
  sortDirection?: QuerySortDirection;
  onSort(): void;
}) {
  const distribution = profile.distribution;
  const sampleLabel = `Based on ${profile.sampleSize} result rows`;
  const sort = sortControl(sortDirection);
  return (
    <div
      className="query-column-header"
      title={`${profile.name} · ${profile.type ?? "Type inferred"} · ${sampleLabel}`}
    >
      <div className="query-column-heading">
        <span className={`query-column-type query-column-type-${profile.kind}`}>
          <WorkbenchIcon name={kindIcon[profile.kind]} size={14} />
        </span>
        <span className="query-column-name">{profile.name}</span>
        <button
          type="button"
          className="query-column-sort"
          aria-label={`${sort.label} by ${profile.name}`}
          aria-pressed={Boolean(sortDirection)}
          title={sort.label}
          onClick={onSort}
        >
          <WorkbenchIcon name={sort.icon} size={14} />
        </button>
      </div>
      {distribution.kind === "histogram" && (
        <div className="query-column-profile">
          <div
            className="query-column-histogram"
            role="img"
            aria-label={`${profile.name} distribution, ${distribution.min} to ${distribution.max}. ${sampleLabel}.`}
          >
            {histogramSlots.map((slot, index) => (
              <i
                key={slot}
                style={{
                  height: `${Math.max(2, ((distribution.bins[index] ?? 0) / Math.max(1, ...distribution.bins)) * 100)}%`,
                }}
              />
            ))}
          </div>
          <div className="query-column-range">
            <span>{distribution.min}</span>
            <span>{distribution.max}</span>
          </div>
        </div>
      )}
      {distribution.kind === "values" && (
        <div
          className="query-column-values"
          title={`${distribution.distinct} distinct values · ${profile.nullCount} null · ${sampleLabel}`}
        >
          {distribution.values.map((value) => (
            <div key={value.key} className="query-column-value">
              <i style={{ width: `${value.percentage}%` }} aria-hidden="true" />
              <span title={value.label}>{value.label}</span>
              <small>{value.percentage.toFixed(1)}%</small>
            </div>
          ))}
          {distribution.distinct > distribution.values.length && (
            <small className="query-column-more">
              +{distribution.distinct - distribution.values.length} more
            </small>
          )}
        </div>
      )}
      {distribution.kind === "empty" && (
        <div className="query-column-no-data">No rows to profile</div>
      )}
    </div>
  );
}
