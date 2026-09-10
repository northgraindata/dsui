import { Button, cn, Surface } from "@northgraindata/dsui-ui";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { runOperation } from "../api";
import { rowsToRecords } from "../result-data";
import type { ServiceView } from "../workspace-navigation";

type ExplorerConfig = NonNullable<ServiceView["databaseExplorer"]>;

function labelFor(column: string) {
  return column.replaceAll("_", " ");
}

function ResultGrid({
  rows,
  columns,
}: {
  rows: Record<string, unknown>[];
  columns: string[];
}) {
  if (!rows.length)
    return (
      <div
        role="status"
        className="px-5 py-12 text-center text-[12px] text-muted"
      >
        No records returned.
      </div>
    );
  return (
    <div className="max-h-[560px] overflow-auto">
      <table className="w-full border-collapse font-mono text-[11px]">
        <thead className="sticky top-0 z-10 bg-surface-raised">
          <tr className="border-b border-border text-left uppercase tracking-[0.07em] text-muted">
            {columns.map((column) => (
              <th key={column} className="px-3 py-2.5 font-medium">
                {labelFor(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              // biome-ignore lint/suspicious/noArrayIndexKey: database rows may not expose a stable key
              key={index}
              className="border-b border-border/60 last:border-0 hover:bg-surface-hover"
            >
              {columns.map((column) => (
                <td
                  key={column}
                  className="max-w-[360px] truncate whitespace-pre px-3 py-2 text-secondary"
                  title={String(row[column] ?? "")}
                >
                  {String(row[column] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableWorkspace({
  serviceId,
  viewId,
  database,
  objectName,
  objectType,
  tabId,
  config,
}: {
  serviceId: string;
  viewId: string;
  database: string;
  objectName: string;
  objectType?: string;
  tabId: string;
  config: ExplorerConfig;
}) {
  const activeTab =
    config.tabs.find((tab) => tab.id === tabId) ?? config.tabs[0];
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const pageSize = 100;

  useEffect(() => {
    if (!activeTab) return;
    let live = true;
    setLoading(true);
    setError(undefined);
    runOperation(serviceId, activeTab.capability, {
      database,
      table: objectName,
      limit: pageSize,
      offset,
    })
      .then((response) => {
        if (!live) return;
        const resultColumns = response.columns ?? [];
        setColumns(resultColumns);
        setRows(rowsToRecords(response.data, resultColumns));
      })
      .catch((reason) => {
        if (live)
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load table details",
          );
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [activeTab, database, objectName, offset, serviceId]);

  if (!activeTab) return null;
  const ddl = String(rows[0]?.[columns[0] ?? ""] ?? "");
  return (
    <section className="min-w-0">
      <header className="border-b border-border px-5 py-4">
        <p className="m-0 font-mono text-[10px] text-muted">{database}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="m-0 font-mono text-[16px] font-semibold text-primary">
            {objectName}
          </h2>
          {objectType ? (
            <span className="border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
              {objectType}
            </span>
          ) : null}
        </div>
      </header>
      <nav
        aria-label="Table details"
        className="flex overflow-x-auto border-b border-border px-3"
      >
        {config.tabs.map((tab) => (
          <Link
            key={tab.id}
            to="/services/$serviceId/$viewId/$database/$objectName/$tabId"
            params={{
              serviceId,
              viewId,
              database,
              objectName,
              tabId: tab.id,
            }}
            aria-current={tab.id === activeTab.id ? "page" : undefined}
            className={cn(
              "relative shrink-0 px-3 py-2.5 font-mono text-[10.5px] no-underline hover:text-primary",
              tab.id === activeTab.id
                ? "text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-accent"
                : "text-muted",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {error ? (
        <div
          role="alert"
          className="m-5 border border-unavailable/40 bg-unavailable/10 p-3 text-[12px] text-unavailable"
        >
          {error}
        </div>
      ) : loading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading table details"
          className="grid gap-2 p-5"
        >
          <span className="h-2.5 animate-pulse bg-surface-hover motion-reduce:animate-none" />
          <span className="h-2.5 w-2/3 animate-pulse bg-surface-hover motion-reduce:animate-none" />
        </div>
      ) : activeTab.kind === "code" ? (
        <div className="p-5">
          <Surface className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                Create statement
              </span>
              <Button
                size="small"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(ddl);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="m-0 max-h-[560px] overflow-auto whitespace-pre-wrap p-4 font-mono text-[11.5px] leading-relaxed text-secondary">
              {ddl || "No DDL returned."}
            </pre>
          </Surface>
        </div>
      ) : activeTab.kind === "record-detail" ? (
        <dl className="grid grid-cols-1 border-b border-border sm:grid-cols-2 xl:grid-cols-3">
          {columns.map((column) => (
            <div key={column} className="border-t border-r border-border p-3">
              <dt className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-muted">
                {labelFor(column)}
              </dt>
              <dd className="mt-1.5 mb-0 break-words font-mono text-[11.5px] text-secondary">
                {String(rows[0]?.[column] ?? "—")}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <>
          <ResultGrid rows={rows} columns={columns} />
          {activeTab.id === "data" || activeTab.id === "parts" ? (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="font-mono text-[10px] text-muted">
                Rows {offset + 1}–{offset + rows.length}
              </span>
              <div className="flex gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={offset === 0}
                  onClick={() =>
                    setOffset((value) => Math.max(0, value - pageSize))
                  }
                >
                  Previous
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={rows.length < pageSize}
                  onClick={() => setOffset((value) => value + pageSize)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
