import type { Finding, RunDetail } from "../contract";
import { React } from "./react";

const isProblem = (finding: Finding) => finding.severity !== "low";

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <li className="dx-finding" data-severity={finding.severity}>
      <span className="dx-severity">{finding.severity}</span>
      <div>
        <strong>
          {finding.identifier ?? finding.axis}
          {finding.column ? `.${finding.column}` : ""}
        </strong>
        <p>{finding.detail}</p>
        <small>
          {finding.source === "verify" ? "Verify" : "Drift"} · {finding.axis} ·{" "}
          {finding.code}
        </small>
      </div>
    </li>
  );
}

export function Findings({ run }: { run: RunDetail }) {
  const [showLow, setShowLow] = React.useState(false);
  const problems = run.findings.filter(isProblem);
  const low = run.findings.filter((finding) => !isProblem(finding));
  const shown = showLow ? run.findings : problems;
  const lowTotal = run.findingCount - run.problemCount;
  return (
    <>
      <div className="dx-heading">
        <h3>Problems ({run.problemCount})</h3>
        {low.length > 0 && (
          <button type="button" onClick={() => setShowLow(!showLow)}>
            {showLow ? "Hide" : "Show"} {lowTotal} low severity
          </button>
        )}
      </div>
      {shown.length > 0 ? (
        <ul className="dx-findings">
          {shown.map((finding) => (
            <FindingRow
              key={`${finding.source}/${finding.code}/${finding.identifier}/${finding.column}/${finding.detail}`}
              finding={finding}
            />
          ))}
        </ul>
      ) : (
        <p className="dx-empty">
          {run.status === "queued" || run.status === "running"
            ? "Checking…"
            : "No problems in the checks that ran."}
        </p>
      )}
      {run.findings.length < run.findingCount && (
        <p>
          Showing {run.findings.length} of {run.findingCount} findings, worst
          first.
        </p>
      )}
      {run.notChecked.length > 0 && (
        <details className="dx-details">
          <summary>Dex could not check ({run.notChecked.length})</summary>
          <ul>
            {run.notChecked.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
