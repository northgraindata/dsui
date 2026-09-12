import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { PrimitiveDoc } from "../../lib/primitive-catalog";

const PrimitivePreview = lazy(() => import("./PrimitivePreview"));

export default function PrimitiveCatalogClient({
  primitives,
}: {
  primitives: PrimitiveDoc[];
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(primitives[0]?.id ?? "");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return primitives;
    return primitives.filter((primitive) =>
      `${primitive.componentName} ${primitive.id} ${primitive.props
        .map((prop) => prop.name)
        .join(" ")}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [primitives, query]);
  const selected =
    primitives.find((primitive) => primitive.id === selectedId) ??
    primitives[0];

  useEffect(() => {
    const id = window.location.hash.replace(/^#component-/, "");
    if (primitives.some((primitive) => primitive.id === id)) setSelectedId(id);
  }, [primitives]);

  if (!selected) return null;

  const select = (id: string) => {
    setSelectedId(id);
    window.history.replaceState(null, "", `#component-${id}`);
  };

  return (
    <section
      className="primitive-catalog not-prose"
      aria-label="Component catalog"
    >
      <div className="primitive-catalog-toolbar">
        <div>
          <p className="primitive-catalog-count">
            {primitives.length} generated components
          </p>
          <p>Contracts come directly from the adapter SDK source.</p>
        </div>
        <label>
          <span className="sr-only">Filter components</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter components…"
          />
        </label>
      </div>

      <div className="primitive-catalog-layout">
        <nav className="primitive-catalog-nav" aria-label="SDK primitives">
          {filtered.length > 0 ? (
            filtered.map((primitive) => (
              <button
                type="button"
                key={primitive.id}
                data-active={primitive.id === selected.id}
                onClick={() => select(primitive.id)}
              >
                <span>{primitive.componentName}</span>
                <code>{primitive.id}</code>
              </button>
            ))
          ) : (
            <p role="status">No components match “{query}”.</p>
          )}
        </nav>

        <article className="primitive-catalog-detail" aria-live="polite">
          <header>
            <div>
              <p className="primitive-catalog-kind">SDK PRIMITIVE</p>
              <h2 className="primitive-detail-title">
                {selected.componentName}
              </h2>
            </div>
            <a
              href={`https://github.com/northgraindata/dsui/blob/main/${selected.sourcePath}`}
            >
              View source <span aria-hidden="true">↗</span>
            </a>
          </header>

          <section
            className="primitive-preview"
            aria-label={`${selected.componentName} preview`}
          >
            <div className="primitive-preview-heading">
              <span>Live preview</span>
              <code>{`<${selected.componentName} />`}</code>
            </div>
            <div className="primitive-preview-stage">
              <Suspense fallback={<PreviewSkeleton />}>
                <PrimitivePreview id={selected.id} />
              </Suspense>
            </div>
          </section>

          <section
            className="primitive-props"
            aria-labelledby="primitive-props-title"
          >
            <div className="primitive-section-heading">
              <h3 id="primitive-props-title">{selected.propsName}</h3>
              <span className="primitive-section-meta">
                {selected.props.length} properties
              </span>
            </div>
            <table className="primitive-props-table">
              <thead>
                <tr className="primitive-props-head">
                  <th scope="col">Property</th>
                  <th scope="col">Type</th>
                  <th scope="col">Required</th>
                </tr>
              </thead>
              <tbody>
                {selected.props.map((prop) => (
                  <tr key={prop.name}>
                    <td>
                      <code>{prop.name}</code>
                    </td>
                    <td>
                      <code>{prop.type}</code>
                    </td>
                    <td data-required={prop.required}>
                      {prop.required ? "Yes" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {selected.supportingTypes.length > 0 && (
            <section
              className="primitive-types"
              aria-labelledby="primitive-types-title"
            >
              <div className="primitive-section-heading">
                <h3 id="primitive-types-title">Related types</h3>
              </div>
              {selected.supportingTypes.map((type) => (
                <details key={type.name}>
                  <summary>{type.name}</summary>
                  <pre>
                    <code>{type.declaration}</code>
                  </pre>
                </details>
              ))}
            </section>
          )}
        </article>
      </div>
    </section>
  );
}

function PreviewSkeleton() {
  return (
    <div
      className="primitive-preview-skeleton"
      role="status"
      aria-label="Loading preview"
    >
      <span className="primitive-preview-skeleton-line" />
      <span className="primitive-preview-skeleton-line" />
    </div>
  );
}
