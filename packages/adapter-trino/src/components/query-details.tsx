import { LivePlan, Performance, Timeline } from "./query-diagnostics";
import { React } from "./react";
import {
  type Client,
  DataTable,
  ErrorMessage,
  Facts,
  Json,
  object,
  objects,
  Panel,
  text,
  useData,
} from "./shared";
export function Query({
  client,
  queryId,
}: {
  client: Client;
  queryId: string;
}) {
  const finished = (value: unknown) =>
    Boolean(object(value).finalQueryInfo) ||
    ["FINISHED", "FAILED"].includes(text(object(value).state));
  const result = useData(
    client,
    "monitor",
    { view: "query", queryId },
    true,
    finished,
  );
  const [tab, setTab] = React.useState("Overview");
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const query = object(result.data);
  const terminal = finished(query);
  const kill = async () => {
    if (!window.confirm("Cancel this running query?")) return;
    setBusy(true);
    setError(undefined);
    try {
      const response = await client.executeAction({
        actionId: "kill-query",
        input: { queryId },
      });
      if (response.status === "error") throw new Error(response.message);
      result.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not cancel query",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="tr-toolbar">
        <h2>Query · {queryId}</h2>
        <span className="tr-badge" data-state={text(query.state)}>
          {text(query.state)}
        </span>
        {Boolean(result.data) && !terminal && (
          <button type="button" onClick={() => void kill()} disabled={busy}>
            {busy ? "Cancelling…" : "Kill query"}
          </button>
        )}
      </div>
      <ErrorMessage message={result.error ?? error} />
      <nav className="tr-nav" aria-label="Query details">
        {[
          "Overview",
          "Live plan",
          "Stage performance",
          "Splits",
          "JSON",
          "References",
        ].map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={tab === name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      {Boolean(result.data) && (
        <>
          {tab === "Overview" && (
            <>
              <Panel title="SQL">
                <pre className="tr-code">{text(query.query)}</pre>
                <button
                  type="button"
                  onClick={() =>
                    void navigator.clipboard.writeText(text(query.query))
                  }
                >
                  Copy SQL
                </button>
              </Panel>
              <div className="tr-grid">
                <Panel title="Session">
                  <Facts value={query.session} />
                </Panel>
                <Panel title="Execution">
                  <Facts value={query.queryStats} />
                </Panel>
              </div>
              <Timeline query={query} />
              {Boolean(query.failureInfo) && (
                <Panel title="Failure">
                  <Facts value={query.failureInfo} />
                  <Json value={query.failureInfo} />
                </Panel>
              )}
              {objects(query.warnings).length > 0 && (
                <Panel title="Warnings">
                  <DataTable rows={objects(query.warnings)} />
                </Panel>
              )}
            </>
          )}
          {tab === "Live plan" && <LivePlan query={query} />}
          {tab === "Stage performance" && (
            <Performance client={client} query={query} />
          )}
          {tab === "Splits" && <Timeline query={query} splits />}
          {tab === "JSON" && (
            <Panel title="Query JSON">
              <button
                type="button"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(query, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${queryId}.json`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download JSON
              </button>
              <Json value={query} />
            </Panel>
          )}
          {tab === "References" && (
            <>
              <Panel title="Referenced tables">
                <DataTable rows={objects(query.referencedTables)} />
              </Panel>
              <Panel title="Routines">
                <DataTable rows={objects(query.routines)} />
              </Panel>
            </>
          )}
        </>
      )}
    </>
  );
}
