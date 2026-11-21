import { Button, Input } from "@northgraindata/dsui-ui";
import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import logo from "../../site/public/branding/logo-icon.svg";
import { catalog, groups } from "./catalog";
import type { CatalogEntry, Example } from "./catalog-types";
import { PreviewBoundary } from "./preview";
import "./styles.css";

function readRoute() {
  return decodeURI(window.location.hash.slice(1)) || "foundations/colors";
}
function ExampleCard({
  example,
  entry,
  width,
  revision,
}: {
  example: Example;
  entry: CatalogEntry;
  width: string;
  revision: number;
}) {
  const observer = useRef<ResizeObserver | null>(null);
  useEffect(() => () => observer.current?.disconnect(), []);
  return (
    <section id={example.id} className="lab-example">
      <header>
        <h2>{example.title}</h2>
        <a
          href={`#${entry.id}?state=${encodeURIComponent(example.id)}`}
          aria-label={`Link to ${example.title}`}
        >
          ↗
        </a>
      </header>
      <div className="lab-preview-scroll">
        <iframe
          title={`${entry.title}: ${example.title}`}
          onLoad={(event) => {
            observer.current?.disconnect();
            const frame = event.currentTarget;
            const body = frame.contentDocument?.body;
            if (!body) return;
            const resize = () => {
              frame.style.height = `${Math.min(960, Math.max(entry.id === "ui/dialog-content" ? 420 : 180, Math.ceil(body.getBoundingClientRect().height) + 2))}px`;
            };
            observer.current = new ResizeObserver(resize);
            observer.current.observe(body);
            resize();
          }}
          src={`?preview=${encodeURIComponent(entry.id)}&state=${encodeURIComponent(example.id)}&revision=${revision}`}
          style={{ width: width === "narrow" ? 390 : "100%" }}
        />
      </div>
    </section>
  );
}
function IsolatedPreview({ example }: { example: Example }) {
  return (
    <div className="lab-isolated">
      <PreviewBoundary>
        {example.render(example.scenario ?? "normal")}
      </PreviewBoundary>
    </div>
  );
}
function Lab() {
  const [route, setRoute] = useState(readRoute);
  const [search, setSearch] = useState("");
  const [width, setWidth] = useState("wide");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const changed = () => setRoute(readRoute());
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const [id, query] = route.split("?");
  const entry = catalog.find((item) => item.id === id);
  const state = new URLSearchParams(query).get("state");
  const count = catalog.reduce((sum, item) => sum + item.examples.length, 0);
  return (
    <div className="lab-shell">
      <aside className="lab-sidebar">
        <a className="lab-brand" href="#foundations/colors">
          <img
            className="lab-brand-mark"
            src={logo}
            width="33"
            height="33"
            alt=""
          />
          <span>
            DSUI <b>UI Lab</b>
          </span>
        </a>
        <p className="lab-sidebar-copy">The interface, laid out.</p>
        <Input
          aria-label="Search catalog"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a component…"
        />
        <nav aria-label="UI catalog">
          {groups.map((group) => (
            <section key={group}>
              <h2>{group}</h2>
              {catalog
                .filter(
                  (item) =>
                    item.group === group &&
                    `${item.title} ${item.description}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                )
                .map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    aria-current={id === item.id ? "page" : undefined}
                  >
                    <span>{item.title}</span>
                    <small>{item.examples.length || "gap"}</small>
                  </a>
                ))}
            </section>
          ))}
        </nav>
        <footer>
          {catalog.length} entries · {count} examples
          <br />
          Local fixtures · production components
        </footer>
      </aside>
      <main className="lab-main">
        <div className="lab-topbar">
          <span>DSUI / {entry?.group ?? "Catalog"}</span>
          <div>
            <label>
              Viewport{" "}
              <select
                aria-label="Preview width"
                value={width}
                onChange={(event) => setWidth(event.target.value)}
              >
                <option value="wide">Fluid</option>
                <option value="narrow">390px</option>
              </select>
            </label>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setRevision((value) => value + 1)}
            >
              Reset examples
            </Button>
          </div>
        </div>
        {entry ? (
          <>
            <header className="lab-page-heading">
              <span className="lab-eyebrow">{entry.group}</span>
              <h1>{entry.title}</h1>
              <p>{entry.description}</p>
              <code>{entry.source}</code>
            </header>
            {entry.note && <p className="lab-notice">{entry.note}</p>}
            {state && (
              <p className="lab-state-link">
                Showing one state. <a href={`#${entry.id}`}>Show all states</a>
              </p>
            )}
            <div className="lab-examples">
              {entry.examples
                .filter((example) => !state || example.id === state)
                .map((example) => (
                  <ExampleCard
                    key={example.id}
                    example={example}
                    entry={entry}
                    width={width}
                    revision={revision}
                  />
                ))}
            </div>
          </>
        ) : (
          <p className="lab-notice">
            Unknown entry. Choose a component from the catalog.
          </p>
        )}
      </main>
    </div>
  );
}
const params = new URLSearchParams(window.location.search);
const entry = catalog.find((item) => item.id === params.get("preview"));
const example = entry?.examples.find((item) => item.id === params.get("state"));
const root = document.getElementById("root");
if (!root) throw new Error("UI Lab root is missing");
let content = <Lab />;
if (params.has("preview")) {
  content =
    entry && example ? (
      <IsolatedPreview example={example} />
    ) : (
      <p role="alert">Unknown preview.</p>
    );
}
createRoot(root).render(<StrictMode>{content}</StrictMode>);
