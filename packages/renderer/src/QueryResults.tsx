import { Button } from "@northgraindata/dsui-ui";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import {
  cellText,
  elapsedLabel,
  type QueryResultView,
  queryCsv,
} from "./query-result";
import { WorkbenchIcon } from "./WorkbenchIcon";

function columnIcon(type?: string) {
  return type && /DATE|TIME/.test(type) ? "calendar" : "hash";
}

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
  const scrollContainer = useRef<HTMLDivElement>(null);
  const rowCount = result && !error ? result.rows.length : 0;
  const resultRows = result?.rows;
  // Rows have a fixed height (31px td, border-box, nowrap cells), so the
  // estimate is exact; measureElement self-corrects if CSS drifts.
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollContainer.current,
    estimateSize: () => 31,
    overscan: 10,
  });
  useEffect(() => {
    if (resultRows) scrollContainer.current?.scrollTo({ top: 0 });
  }, [resultRows]);
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const lastVirtualRow = virtualRows[virtualRows.length - 1];
  const paddingBottom = lastVirtualRow
    ? rowVirtualizer.getTotalSize() - lastVirtualRow.end
    : 0;
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
          <div className="query-table-scroll" ref={scrollContainer}>
            {result && !error ? (
              <table
                className="query-data-table"
                aria-rowcount={result.rows.length + 1}
              >
                <thead>
                  <tr>
                    {result.columns.map((column) => (
                      <th key={column.name}>
                        <div>
                          <WorkbenchIcon
                            name={columnIcon(column.type)}
                            size={18}
                          />
                          <span>
                            {column.name}
                            <small>{column.type ?? "TYPE UNAVAILABLE"}</small>
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paddingTop > 0 ? (
                    <tr className="query-virtual-spacer">
                      <td
                        colSpan={result.columns.length || 1}
                        style={{ height: paddingTop }}
                      />
                    </tr>
                  ) : null}
                  {virtualRows.map((virtualRow) => {
                    const row = result.rows[virtualRow.index];
                    return (
                      // SQL results may contain identical rows and have no stable key; each result replaces the entire stateless table.
                      <tr
                        key={`${virtualRow.index}:${JSON.stringify(row)}`}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        aria-rowindex={virtualRow.index + 2}
                      >
                        {result.columns.map((column) => (
                          <td key={column.name}>
                            {row[column.name] === null ? (
                              <span className="null-cell">NULL</span>
                            ) : (
                              cellText(row[column.name])
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 ? (
                    <tr className="query-virtual-spacer">
                      <td
                        colSpan={result.columns.length || 1}
                        style={{ height: paddingBottom }}
                      />
                    </tr>
                  ) : null}
                </tbody>
              </table>
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
