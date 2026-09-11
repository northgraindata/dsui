import { Button } from "@northgraindata/dsui-ui";
import { useRef, useState } from "react";
import { WorkbenchIcon } from "../icons";
import { DataTable } from "../data-table";
import {
  elapsedLabel,
  type QueryResultView,
  queryCsv,
} from "./query-result";

export function QueryResults({
  result,
  error,
  running,
}: {
  result?: QueryResultView;
  error?: string;
  running: boolean;
}) {
  const [tab, setTab] = useState("results");
  const [displayError, setDisplayError] = useState<string>();
  const container = useRef<HTMLElement>(null);
  const exportCsv = () => {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([queryCsv(result)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "query-results.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section
      ref={container}
      className="query-results"
      aria-label="Query results"
      aria-busy={running}
    >
      <header className="results-toolbar">
        <div
          className="result-view-tabs"
          role="tablist"
          aria-label="Result view"
        >
          {["results", "chart"].map((view) => (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={tab === view}
              aria-controls={`query-${view}-panel`}
              id={`query-${view}-tab`}
              onClick={() => setTab(view)}
            >
              {view === "results" ? "Results" : "Chart"}
            </button>
          ))}
        </div>
        <span className="query-status" role="status">
          {running
            ? "Running…"
            : error
              ? "Query failed"
              : result
                ? `${result.rows.length.toLocaleString()} rows${result.elapsedMs !== undefined ? ` • ${elapsedLabel(result.elapsedMs)}` : ""}`
                : "Ready to run"}
          {result && !error && !running && <i />}
        </span>
        <Button
          variant="secondary"
          className="export-query"
          onClick={exportCsv}
          disabled={!result || !!error || running}
        >
          <WorkbenchIcon name="download" />
          Export
        </Button>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Expand query results"
          onClick={() => {
            const action = document.fullscreenElement
              ? document.exitFullscreen()
              : container.current?.requestFullscreen();
            action?.catch(() =>
              setDisplayError("Full screen is unavailable in this browser."),
            );
          }}
        >
          <WorkbenchIcon name="expand" />
        </Button>
      </header>
      {displayError && (
        <p className="query-error" role="alert">
          {displayError}
        </p>
      )}
      {error && (
        <p className="query-error" role="alert">
          {error}
        </p>
      )}
      {tab === "chart" ? (
        <div
          className="query-empty"
          id="query-chart-panel"
          role="tabpanel"
          aria-labelledby="query-chart-tab"
        >
          <WorkbenchIcon name="table" size={28} />
          <h2>Visualize your results</h2>
          <p>
            Charts are coming soon. Your results are available in the Results
            tab.
          </p>
        </div>
      ) : (
        <div
          className="query-result-body"
          id="query-results-panel"
          role="tabpanel"
          aria-labelledby="query-results-tab"
        >
          <div className="query-table-scroll">
            {result && !error ? (
              <DataTable columns={result.columns} rows={result.rows} />
            ) : (
              <div className="query-empty">
                <WorkbenchIcon name="play" size={28} />
                <h2>{error ? "Review your query" : "Ready when you are"}</h2>
                <p>
                  {error
                    ? "Update your SQL and run it again."
                    : "Run a query to explore your results."}
                </p>
                {!error && <kbd>⌘ / Ctrl + Enter</kbd>}
              </div>
            )}
            {result && !error && !result.rows.length && (
              <p className="query-empty-message">
                {result.rowsChanged !== undefined
                  ? `${result.rowsChanged} rows changed.`
                  : "Query completed. No rows returned."}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
