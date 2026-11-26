import { DeclarativePageRenderer } from "@northgraindata/dsui-renderer";
import { SCENARIOS, type Scenario } from "@northgraindata/dsui-ui-fixtures";
import { useEffect, useMemo, useState } from "react";
import { fixtureClient } from "./client";
import {
  type Fixture,
  loadFixture,
  loadManifest,
  type ManifestAdapter,
} from "./data";

const WIDTHS = ["full", "360", "768", "1280", "split"] as const;

function isScenario(value: string | null): value is Scenario {
  return SCENARIOS.some((scenario) => scenario === value);
}

export function App() {
  const search = new URLSearchParams(window.location.search);
  const adapter = search.get("adapter");
  const slug = search.get("page");
  const requested = search.get("scenario");
  const scenario = isScenario(requested) ? requested : "default";
  if (!adapter || !slug) return <Index />;
  return (
    <FixturePage
      adapter={adapter}
      slug={slug}
      scenario={scenario}
      width={search.get("width") ?? "full"}
    />
  );
}

function Index() {
  const [adapters, setAdapters] = useState<ManifestAdapter[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    loadManifest().then(setAdapters, (cause: Error) => setError(cause.message));
  }, []);
  return (
    <main className="gallery-index">
      <h1>DSUI fixture gallery</h1>
      {error ? <p role="alert">{error}</p> : null}
      {adapters.map((adapter) => (
        <section key={adapter.id}>
          <h2>{adapter.name}</h2>
          <ul>
            {adapter.pages.map((page) => (
              <li key={page.slug}>
                <code>{page.path}</code>
                {SCENARIOS.map((scenario) => (
                  <a
                    key={scenario}
                    href={`?${new URLSearchParams({ adapter: adapter.id, page: page.slug, scenario })}`}
                  >
                    {scenario}
                  </a>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p>Add &width= with one of: {WIDTHS.join(", ")}.</p>
    </main>
  );
}

function FixturePage({
  adapter,
  slug,
  scenario,
  width,
}: {
  adapter: string;
  slug: string;
  scenario: Scenario;
  width: string;
}) {
  const [fixture, setFixture] = useState<Fixture>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    loadFixture(adapter, slug, scenario).then(setFixture, (cause: Error) =>
      setError(cause.message),
    );
  }, [adapter, slug, scenario]);
  const client = useMemo(
    () => fixture && fixtureClient(fixture.resources, scenario),
    [fixture, scenario],
  );
  if (error) return <p role="alert">{error}</p>;
  if (!fixture || !client) return null;
  const page = (
    <div className="adapter-main-content" data-gallery-pane="">
      <DeclarativePageRenderer client={client} nodes={fixture.nodes} />
    </div>
  );
  if (width === "split")
    return (
      <div className="gallery-split" data-gallery-ready="">
        <div className="adapter-pane-grid">
          {page}
          <div className="adapter-secondary-pane">{page}</div>
        </div>
      </div>
    );
  return (
    <div
      className="gallery-frame"
      data-gallery-ready=""
      style={Number(width) ? { width: Number(width) } : undefined}
    >
      {page}
    </div>
  );
}
