import { WorkbenchIcon } from "./icons";
import type { TableInsightsData } from "./table-data";

const numberFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});
const histogramSlots = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function TableInsights({ data }: { data: TableInsightsData }) {
  const numeric = data.numeric;
  const top = data.top;
  return (
    <section className="table-insights" aria-label="Quick table insights">
      <div className="table-insights-intro">
        <strong>Quick insights</strong>
        <span>Based on {data.sampleSize} loaded rows</span>
      </div>
      {numeric && (
        <div className="table-insights-card">
          <span className="table-insights-icon">
            <WorkbenchIcon name="activity" size={18} />
          </span>
          <div className="table-insights-copy">
            <strong>{numeric.column.label}</strong>
            <small>Distribution</small>
            <div className="table-insights-histogram" aria-hidden="true">
              {histogramSlots.map((slot, index) => (
                <i
                  key={slot}
                  style={{
                    height: `${((numeric.bins[index] ?? 0) / Math.max(1, ...numeric.bins)) * 100}%`,
                  }}
                />
              ))}
            </div>
          </div>
          <dl className="table-insights-stats">
            <div>
              <dt>min</dt>
              <dd>{numberFormat.format(numeric.min)}</dd>
            </div>
            <div>
              <dt>max</dt>
              <dd>{numberFormat.format(numeric.max)}</dd>
            </div>
            <div>
              <dt>avg</dt>
              <dd>{numberFormat.format(numeric.average)}</dd>
            </div>
          </dl>
        </div>
      )}
      {top && (
        <div className="table-insights-card">
          <span className="table-insights-icon">
            <WorkbenchIcon name="table" size={18} />
          </span>
          <div className="table-insights-copy">
            <strong>Top {top.column.label} values</strong>
            <div className="table-insights-top-values">
              {top.values.map((value) => (
                <div key={value.key}>
                  <span title={value.label}>{value.label}</span>
                  <i aria-hidden="true">
                    <b
                      style={{
                        width: `${(value.count / Math.max(1, top.values[0]?.count ?? 1)) * 100}%`,
                      }}
                    />
                  </i>
                  <em>{value.count}</em>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {data.distinct.length > 0 && (
        <div className="table-insights-card table-insights-distinct">
          <span className="table-insights-icon">
            <WorkbenchIcon name="hash" size={18} />
          </span>
          <div className="table-insights-copy">
            <strong>Distinct values</strong>
            <div>
              {data.distinct.map((entry) => (
                <span key={entry.column.id}>
                  <b>{numberFormat.format(entry.count)}</b>
                  <small>{entry.column.label}</small>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
