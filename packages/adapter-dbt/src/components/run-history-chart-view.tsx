import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import { componentProps } from "@northgraindata/dsui-adapter-sdk";
import type { RunHistoryDay } from "./dashboard-metrics";

type Props = { history: readonly RunHistoryDay[] };

export default function RunHistoryChart(props: ComponentProps) {
  const data = componentProps<Props>(props.node);
  if (!data) return null;
  const maximum = Math.max(1, ...data.history.map((day) => total(day)));
  return (
    <div className="dbt-run-history">
      <style>{styles}</style>
      <div
        className="dbt-run-history-plot"
        role="img"
        aria-label={summary(data.history)}
      >
        {data.history.map((day) => {
          const count = total(day);
          const height = count ? Math.max(4, (count / maximum) * 84) : 0;
          const successHeight = count ? (day.success / count) * height : 0;
          const warningHeight = count ? (day.warning / count) * height : 0;
          const errorHeight = count ? (day.error / count) * height : 0;
          return (
            <div className="dbt-run-history-day" key={day.date}>
              <span className="dbt-run-history-value">
                {count ? `${count} ${count === 1 ? "run" : "runs"}` : "No runs"}
              </span>
              <div
                className="dbt-run-history-bar"
                title={`${day.label}: ${count} runs`}
                style={{ height: `${height}px` }}
                aria-hidden="true"
              >
                {successHeight > 0 ? (
                  <i
                    className="is-success"
                    style={{ height: `${successHeight}px` }}
                  />
                ) : null}
                {warningHeight > 0 ? (
                  <i
                    className="is-warning"
                    style={{ height: `${warningHeight}px` }}
                  />
                ) : null}
                {errorHeight > 0 ? (
                  <i
                    className="is-error"
                    style={{ height: `${errorHeight}px` }}
                  />
                ) : null}
              </div>
              <span className="dbt-run-history-label">{day.label}</span>
            </div>
          );
        })}
      </div>
      <div className="dbt-run-history-legend" aria-hidden="true">
        <span>
          <i className="is-success" />
          Successful
        </span>
        <span>
          <i className="is-warning" />
          Warnings
        </span>
        <span>
          <i className="is-error" />
          Failed
        </span>
      </div>
    </div>
  );
}

function total(day: RunHistoryDay) {
  return day.success + day.warning + day.error;
}

function summary(days: readonly RunHistoryDay[]) {
  const totalRuns = days.reduce((sum, day) => sum + total(day), 0);
  const failed = days.reduce((sum, day) => sum + day.error, 0);
  const warned = days.reduce((sum, day) => sum + day.warning, 0);
  return `Run history for the last seven days: ${totalRuns} runs, ${failed} failed, ${warned} with warnings.`;
}

const styles = `
.dbt-run-history{min-width:0;padding:16px 18px 14px;border:1px solid var(--color-border);border-radius:10px;background:var(--color-surface)}
.dbt-run-history-plot{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));align-items:end;gap:10px;min-height:128px;padding:8px 2px 0;border-bottom:1px solid var(--color-border)}
.dbt-run-history-day{display:flex;min-width:0;height:128px;flex-direction:column;align-items:center;justify-content:flex-end;gap:7px}
.dbt-run-history-value{min-height:14px;font-size:10px;color:var(--color-muted);white-space:nowrap}
.dbt-run-history-bar{display:flex;width:min(22px,75%);min-height:0;flex-direction:column;justify-content:flex-end;overflow:hidden;border-radius:6px 6px 2px 2px;background:transparent}
.dbt-run-history-bar i{display:block;width:100%;min-height:2px}
.dbt-run-history-bar .is-success{background:var(--color-accent)}
.dbt-run-history-bar .is-warning{background:var(--color-warning)}
.dbt-run-history-bar .is-error{background:var(--color-unavailable)}
.dbt-run-history-label{height:17px;font-size:10px;color:var(--color-secondary);white-space:nowrap}
.dbt-run-history-legend{display:flex;flex-wrap:wrap;gap:16px;margin-top:13px;color:var(--color-secondary);font-size:10px}
.dbt-run-history-legend span{display:inline-flex;align-items:center;gap:6px}
.dbt-run-history-legend i{width:7px;height:7px;border-radius:50%;background:var(--color-accent)}
.dbt-run-history-legend .is-warning{background:var(--color-warning)}
.dbt-run-history-legend .is-error{background:var(--color-unavailable)}
@media(max-width:520px){.dbt-run-history-plot{gap:4px}.dbt-run-history-label{font-size:9px}.dbt-run-history-legend{gap:10px}}
`;
