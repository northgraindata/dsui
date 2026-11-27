/** The raw Dex results: tables, metrics, plans and the diagram source. */
import { z } from "zod";
import type { ViewKind } from "../views";
import { type Client, useResource } from "./client";
import { when } from "./format";
import { React } from "./react";

const MAX_ROWS = 200;

const rowsSchema = z.array(
  z.record(z.union([z.string(), z.number(), z.null()])),
);
const statusSchema = z.array(
  z.object({
    status: z.string(),
    message: z.string(),
    checked: z.string(),
    dataFrom: z.string(),
  }),
);
const diagramSchema = z.object({ mermaid: z.string() });

const TABLES = {
  inventory: [
    ["object", "Object"],
    ["type", "Type"],
    ["rows", "Rows (estimate)"],
    ["columns", "Columns"],
  ],
  semantic: [
    ["metric", "Metric"],
    ["type", "Type"],
    ["label", "Label"],
    ["description", "Description"],
    ["dimensions", "Dimensions"],
  ],
  plans: [
    ["plan", "Plan"],
    ["intent", "Intent"],
    ["files", "Files"],
    ["created", "Created"],
    ["state", "State"],
  ],
} as const;

function Freshness({
  client,
  projectId,
  view,
}: {
  client: Client;
  projectId: string;
  view: ViewKind;
}) {
  const { data } = useResource(
    client,
    "view-status",
    { projectId, view },
    statusSchema,
  );
  const status = data?.[0];
  if (!status) return null;
  return (
    <p className="dx-freshness">
      {status.dataFrom
        ? `Data from ${when(status.dataFrom)}`
        : "No data yet. Run a check."}
      {status.status !== "ok" && status.message ? ` · ${status.message}` : ""}
    </p>
  );
}

export function DataTable({
  client,
  projectId,
  view,
}: {
  client: Client;
  projectId: string;
  view: keyof typeof TABLES;
}) {
  const [search, setSearch] = React.useState("");
  const { data, error } = useResource(
    client,
    "view-rows",
    { projectId, view },
    rowsSchema,
  );
  const columns = TABLES[view];
  const term = search.trim().toLowerCase();
  const matches = (data ?? []).filter(
    (row) =>
      !term ||
      Object.values(row).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(term),
      ),
  );
  return (
    <>
      <Freshness client={client} projectId={projectId} view={view} />
      {error && <p className="dx-error">{error}</p>}
      <input
        type="search"
        aria-label="Search"
        placeholder="Search…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {matches.length > 0 ? (
        <div className="dx-table">
          <table>
            <thead>
              <tr>
                {columns.map(([id, label]) => (
                  <th key={id}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches.slice(0, MAX_ROWS).map((row) => (
                <tr key={JSON.stringify(row)}>
                  {columns.map(([id]) => (
                    <td key={id}>{row[id] ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="dx-empty">{data ? "Nothing to show." : "Loading…"}</p>
      )}
      {matches.length > MAX_ROWS && (
        <p>
          Showing {MAX_ROWS} of {matches.length}. Search to narrow the list.
        </p>
      )}
    </>
  );
}

export function Diagram({
  client,
  projectId,
}: {
  client: Client;
  projectId: string;
}) {
  const { data, error } = useResource(
    client,
    "diagram",
    { projectId },
    diagramSchema,
  );
  const [copied, setCopied] = React.useState(false);
  return (
    <>
      <Freshness client={client} projectId={projectId} view="diagram" />
      {error && <p className="dx-error">{error}</p>}
      <div className="dx-heading">
        <h3>Mermaid ER diagram source</h3>
        <button
          type="button"
          disabled={!data}
          onClick={() => {
            if (data)
              void navigator.clipboard
                ?.writeText(data.mermaid)
                .then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="dx-code">{data?.mermaid ?? "Loading…"}</pre>
    </>
  );
}
