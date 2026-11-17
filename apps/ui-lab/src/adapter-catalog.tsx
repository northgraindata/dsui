import { adapterPages } from "virtual:dsui-adapters";
import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import { DeclarativePageRenderer } from "@northgraindata/dsui-renderer";
import { useMemo, useState } from "react";
import type { CatalogEntry } from "./catalog-types";
import { adapterClient } from "./adapter-fixtures";
import { type Scenario, scenarios } from "./fixtures";

function AdapterPreview({
  nodes,
  scenario,
}: {
  nodes: readonly PageNode[];
  scenario: Scenario;
}) {
  const [event, setEvent] = useState("");
  const client = useMemo(
    () => adapterClient(nodes, scenario, setEvent),
    [nodes, scenario],
  );
  return (
    <>
      <DeclarativePageRenderer nodes={nodes} client={client} />
      <output className="lab-events" aria-live="polite">
        {event}
      </output>
    </>
  );
}
export const adapterCatalog: CatalogEntry[] = adapterPages.map((page) => ({
  id: `adapters/${page.adapter}/${page.name}`,
  title: `${page.adapter === "dbt" ? "dbt" : page.adapter === "s3" ? "S3" : page.adapter} · ${page.path}`,
  group: "Official adapters",
  description: `Production ${page.adapter} page: ${page.path}. Built from its real page definition. Synthetic resource fixtures; actions stay local.`,
  source: page.source,
  note: "Route coverage: the real composition and custom components. Resource data is synthetic, not a backend compatibility check. Store-backed pages use their initial state.",
  examples: scenarios.map((scenario) => ({
    id: scenario,
    title: scenario,
    scenario,
    render: () => <AdapterPreview nodes={page.nodes} scenario={scenario} />,
  })),
}));
