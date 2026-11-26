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
import { Index } from "./index-page";
import { toScenario } from "./scenario";
import { Toolbar } from "./toolbar";
import { pageOnlyUrl, resolveUrl, shellUrl } from "./urls";

const WIDTHS = ["full", "360", "768", "1280", "split"] as const;

export function App() {
  const search = new URLSearchParams(window.location.search);
  const adapter = search.get("adapter");
  const slug = search.get("page");
  if (!adapter || !slug) return <Index />;
  return (
    <FixturePage
      adapter={adapter}
      slug={slug}
      scenario={toScenario(search.get("scenario"))}
      width={search.get("width") ?? "full"}
      at={search.get("at") ?? undefined}
      toolbar={search.get("toolbar") !== "0"}
    />
  );
}

interface Target {
  adapter: string;
  slug: string;
  scenario: Scenario;
  width: string;
  /** The application URL on screen, when it differs from the page's default. */
  at?: string;
}

/** The file for the URL on screen, which a query can change. */
async function loadPage(
  adapterId: string,
  slug: string,
  scenario: Scenario,
  at: string | undefined,
): Promise<Fixture> {
  const adapter = (await loadManifest()).find((item) => item.id === adapterId);
  const file = at && adapter ? resolveUrl(adapter, at)?.file : undefined;
  return loadFixture(adapterId, file ?? slug, scenario);
}

/** Links and tabs move between fixture pages, as they do in the application. */
async function followLink(
  adapterId: string,
  destination: string,
  scenario: Scenario,
  width: string,
): Promise<void> {
  const adapter = (await loadManifest()).find((item) => item.id === adapterId);
  const match = adapter && resolveUrl(adapter, destination);
  if (match)
    window.location.assign(
      pageOnlyUrl(adapterId, match.page.slug, scenario, {
        width,
        at: destination,
      }),
    );
}

function PageControls({ adapter, slug, scenario, width, at }: Target) {
  const [manifest, setManifest] = useState<ManifestAdapter[]>([]);
  useEffect(() => {
    void loadManifest().then(setManifest);
  }, []);
  const page = manifest
    .find((entry) => entry.id === adapter)
    ?.pages.find((entry) => entry.slug === slug);
  return (
    <Toolbar
      scenario={scenario}
      onScenario={(next) =>
        window.location.assign(pageOnlyUrl(adapter, slug, next, { width, at }))
      }
    >
      <span>
        {WIDTHS.map((option) => (
          <a
            key={option}
            aria-current={option === width}
            href={pageOnlyUrl(adapter, slug, scenario, { width: option, at })}
            style={{ marginRight: 8 }}
          >
            {option}
          </a>
        ))}
      </span>
      {page ? (
        <a
          href={shellUrl(adapter, { ...page, href: at ?? page.href }, scenario)}
        >
          With shell
        </a>
      ) : null}
    </Toolbar>
  );
}

function FixturePage({ toolbar, ...target }: Target & { toolbar: boolean }) {
  const { adapter, slug, scenario, width, at } = target;
  const [fixture, setFixture] = useState<Fixture>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    loadPage(adapter, slug, scenario, at).then(setFixture, (cause: Error) =>
      setError(cause.message),
    );
  }, [adapter, slug, scenario, at]);
  const client = useMemo(
    () =>
      fixture &&
      fixtureClient(fixture, scenario, (destination) => {
        void followLink(adapter, destination, scenario, width);
      }),
    [fixture, scenario, adapter, width],
  );
  if (error) return <p role="alert">{error}</p>;
  if (!fixture || !client) return null;
  const page = (
    <div className="adapter-main-content" data-gallery-pane="">
      <DeclarativePageRenderer client={client} nodes={fixture.nodes} />
    </div>
  );
  return (
    <>
      {width === "split" ? (
        <div className="gallery-split" data-gallery-ready="">
          <div className="adapter-pane-grid">
            {page}
            <div className="adapter-secondary-pane">{page}</div>
          </div>
        </div>
      ) : (
        <div
          className="gallery-frame"
          data-gallery-ready=""
          style={Number(width) ? { width: Number(width) } : undefined}
        >
          {page}
        </div>
      )}
      {toolbar ? <PageControls {...target} /> : null}
    </>
  );
}
