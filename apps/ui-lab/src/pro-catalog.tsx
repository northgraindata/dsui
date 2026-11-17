import { available, ProView } from "virtual:dsui-pro";
import { serializeNodes } from "@northgraindata/dsui-adapter-sdk";
import { DeclarativePageRenderer } from "@northgraindata/dsui-renderer";
import { useMemo, useState } from "react";
import type { CatalogEntry } from "./catalog-types";
import { proClient, proFixtures } from "./pro-fixtures";

function ProExample({ view, state }: { view: string; state: string }) {
  const [event, setEvent] = useState("");
  const client = useMemo(() => proClient(state, setEvent), [state]);
  if (!available)
    return (
      <p className="lab-notice">
        Connect your local Pro checkout:{" "}
        <code>DSUI_PRO_DIR=/path/to/dsui-pro bun run ui-lab</code>
      </p>
    );
  return (
    <>
      <ProView
        view={view}
        state={state}
        fixtures={proFixtures(state)}
        client={client}
        onDone={() => setEvent("Local preview updated")}
        renderNode={(nextClient, node) => (
          <DeclarativePageRenderer
            client={nextClient}
            nodes={serializeNodes([node])}
          />
        )}
      />
      <output className="lab-events" aria-live="polite">
        {event}
      </output>
    </>
  );
}
function entry(
  view: string,
  title: string,
  states: string[],
  file: string,
): CatalogEntry {
  return {
    id: `pro/${view}`,
    title,
    group: "DSUI Pro",
    description:
      "Production AI Investigator component, connected to synthetic local fixtures. No AI requests or production actions.",
    source: `dsui-pro/packages/plugin-ai-diagnostics-pro/src/${file}`,
    note: available
      ? undefined
      : "Optional integration: configure DSUI_PRO_DIR to render this component from your private checkout.",
    examples: states.map((state) => ({
      id: state,
      title: state,
      render: () => <ProExample view={view} state={state} />,
    })),
  };
}
export const proCatalog: CatalogEntry[] = [
  entry(
    "run",
    "Investigator · complete run",
    ["normal", "running", "failed", "draft", "loading", "error"],
    "pages/run.tsx",
  ),
  entry(
    "settings",
    "Investigator · agent settings",
    ["normal", "paused", "readonly"],
    "pages/settings.tsx",
  ),
  entry(
    "channels",
    "Investigator · notification settings",
    ["normal", "empty", "readonly"],
    "pages/settings.tsx",
  ),
  entry(
    "investigations",
    "AI Investigator",
    ["normal", "empty", "paused", "readonly", "stress", "loading", "error"],
    "pages/investigations.tsx",
  ),
  entry(
    "manual",
    "New investigation",
    ["normal", "empty", "loading", "error"],
    "components/investigate.tsx",
  ),
  entry(
    "finding",
    "Investigation report",
    ["normal", "draft", "inconclusive"],
    "components/finding-report.tsx",
  ),
  entry(
    "report",
    "CSV incident preview",
    ["normal"],
    "pages/report-preview.tsx",
  ),
  entry(
    "progress",
    "Investigation progress",
    ["queued", "evidence", "investigate", "report", "change"],
    "components/investigation-progress.tsx",
  ),
  entry(
    "evidence",
    "Investigation evidence",
    ["normal", "empty"],
    "components/investigation-evidence.tsx",
  ),
  entry(
    "table",
    "Evidence table",
    ["normal", "empty", "stress"],
    "components/report-table.tsx",
  ),
  entry(
    "log",
    "Evidence log",
    ["normal", "empty", "stress"],
    "components/report-log.tsx",
  ),
  entry(
    "timeline",
    "Investigation timeline",
    ["normal", "empty"],
    "components/investigation-timeline.tsx",
  ),
  entry(
    "workflows",
    "Investigation workflows",
    ["normal", "empty", "paused", "readonly"],
    "pages/workflows.tsx",
  ),
];
