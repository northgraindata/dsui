import type { Scenario } from "@northgraindata/dsui-ui-fixtures";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { loadManifest, type ManifestAdapter } from "../data";
import { Toolbar } from "../toolbar";
import { pageOnlyUrl, resolveUrl } from "../urls";
import { DesignSwitch, FailureSwitch, useDesign } from "./design-switch";
import { Redesign } from "./embedded";
import { redesignFor } from "./redesigns";

/** Where "without shell" leads from the application path on screen. */
function pageOnlyTarget(
  adapters: ManifestAdapter[],
  current: string,
  scenario: Scenario,
): string | undefined {
  const [pathname = "", query = ""] = current.split("?");
  const [, root, serviceId, ...rest] = pathname.split("/");
  const adapter = adapters.find((entry) => entry.id === serviceId);
  if (root !== "services" || !adapter) return undefined;
  const href = `/${rest.join("/")}${query ? `?${query}` : ""}`;
  const match = resolveUrl(adapter, href);
  return (
    match && pageOnlyUrl(adapter.id, match.page.slug, scenario, { at: href })
  );
}

function Controls({ scenario }: { scenario: Scenario }) {
  const [adapters, setAdapters] = useState<ManifestAdapter[]>([]);
  const [current, setCurrent] = useState(location.pathname + location.search);
  useEffect(() => {
    void loadManifest().then(setAdapters);
    // The app navigates with the history API, which fires no event.
    const timer = window.setInterval(
      () => setCurrent(location.pathname + location.search),
      300,
    );
    return () => window.clearInterval(timer);
  }, []);
  const target = pageOnlyTarget(adapters, current, scenario);
  const [design, setDesign] = useDesign();
  const pathname = current.split("?")[0] ?? "";
  const redesign = Boolean(redesignFor(pathname));
  return (
    <>
      {redesign && design === "new" ? <Redesign pathname={pathname} /> : null}
      <Toolbar
        scenario={scenario}
        onScenario={(next) => {
          const search = new URLSearchParams(location.search);
          search.set("scenario", next);
          search.set("shell", "1");
          location.search = search.toString();
        }}
      >
        {redesign ? (
          <DesignSwitch design={design} onChange={setDesign} />
        ) : null}
        {redesign &&
        design === "new" &&
        /^\/services\/(airflow|dagster)(\/|$)/.test(pathname) ? (
          <FailureSwitch />
        ) : null}
        {target ? <a href={target}>Without shell</a> : null}
      </Toolbar>
    </>
  );
}

export function mountControls(scenario: Scenario): void {
  const host = document.createElement("div");
  document.body.append(host);
  createRoot(host).render(<Controls scenario={scenario} />);
}
