import { SCENARIOS } from "@northgraindata/dsui-ui-fixtures";
import { useEffect, useState } from "react";
import { loadManifest, type ManifestAdapter } from "./data";
import { pageOnlyUrl, shellUrl } from "./urls";

/** DSUI's own screens, which only exist inside the application. */
const APP_SCREENS = [
  { label: "Home", href: "/?shell=1" },
  { label: "Services", href: "/services?shell=1" },
  { label: "Add a service", href: "/services/new?shell=1" },
  { label: "Adapter detail", href: "/adapters/airflow?shell=1" },
  { label: "Settings", href: "/settings?shell=1" },
];

export function Index() {
  const [adapters, setAdapters] = useState<ManifestAdapter[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    loadManifest().then(setAdapters, (cause: Error) => setError(cause.message));
  }, []);
  return (
    <main className="gallery-index">
      <h1>DSUI fixture gallery</h1>
      {error ? <p role="alert">{error}</p> : null}
      <section>
        <h2>DSUI application</h2>
        <ul>
          {APP_SCREENS.map((screen) => (
            <li key={screen.href}>
              <a href={`${screen.href}&scenario=default`}>{screen.label}</a>
            </li>
          ))}
        </ul>
      </section>
      {adapters.map((adapter) => (
        <AdapterPages key={adapter.id} adapter={adapter} />
      ))}
    </main>
  );
}

function AdapterLogo({ adapter }: { adapter: ManifestAdapter }) {
  return adapter.catalog.iconUrl ? (
    <img className="gallery-logo" src={adapter.catalog.iconUrl} alt="" />
  ) : null;
}

function AdapterPages({ adapter }: { adapter: ManifestAdapter }) {
  return (
    <section id={adapter.id}>
      <h2>
        <AdapterLogo adapter={adapter} />
        {adapter.name}
      </h2>
      <ul>
        {adapter.pages.map((page) => (
          <li key={page.slug}>
            <code>{page.path}</code>
            <a href={shellUrl(adapter.id, page, "default")}>with shell</a>
            {SCENARIOS.map((scenario) => (
              <a
                key={scenario}
                href={pageOnlyUrl(adapter.id, page.slug, scenario)}
              >
                {scenario}
              </a>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
