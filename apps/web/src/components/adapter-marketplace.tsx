import { Button } from "@northgraindata/dsui-ui";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { Adapter } from "../api";
import { filterAdapterCatalog } from "../features/adapters/catalog-filter";
import { useAdapterCatalog } from "../features/adapters/use-adapter-catalog";
import { ConnectionDialog } from "./connection-dialog";
import { Icon } from "./icon";
import { ServiceMark } from "./service-mark";
import "../features/adapters/adapter-catalog.css";

function AdapterCard({
  adapter,
  connect,
}: {
  adapter: Adapter;
  connect(): void;
}) {
  const unavailable = adapter.status === "unavailable";
  return (
    <article className="adapter-catalog-card">
      <div className="adapter-catalog-card-top">
        <ServiceMark
          adapter={adapter.id}
          logo={adapter.logo}
          size={28}
          variant="bare"
        />
        <Link
          to="/adapters/$adapterId"
          params={{ adapterId: adapter.id }}
          className="adapter-card-title"
        >
          <h2>{adapter.name}</h2>
        </Link>
        <span className="adapter-category">{adapter.category}</span>
      </div>
      <p>{adapter.description}</p>
      {unavailable && (
        <p className="adapter-unavailable" role="status">
          Adapter unavailable
        </p>
      )}
      <footer>
        <Button
          variant="secondary"
          onClick={connect}
          disabled={unavailable}
          title={unavailable ? adapter.detail : undefined}
          aria-label={`Connect ${adapter.name}`}
        >
          Connect <Icon name="plus" size={13} />
        </Button>
      </footer>
    </article>
  );
}

export function AdapterMarketplace() {
  const { adapters, loading, error, retry } = useAdapterCatalog();
  const [selected, setSelected] = useState<Adapter | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const categories = [
    ...new Set(adapters.map((adapter) => adapter.category)),
  ].sort();
  const visible = filterAdapterCatalog(adapters, query, category);
  return (
    <div className="adapter-marketplace adapter-catalog">
      <header className="adapter-catalog-heading">
        <h1>Connect an adapter</h1>
      </header>
      <div className="adapter-catalog-toolbar">
        <label className="adapter-catalog-search">
          <Icon name="search" size={17} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search adapters or capabilities…"
            aria-label="Search adapters"
          />
        </label>
        {!loading && !error && (
          <span className="adapter-catalog-count">
            {adapters.length} available{" "}
            {adapters.length === 1 ? "adapter" : "adapters"}
          </span>
        )}
      </div>
      {!loading && !error && categories.length > 1 && (
        <fieldset
          className="adapter-category-filters"
          aria-label="Filter adapters by category"
        >
          <button
            type="button"
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
          >
            All adapters <span>{adapters.length}</span>
          </button>
          {categories.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
            >
              {value}
              <span>
                {
                  adapters.filter((adapter) => adapter.category === value)
                    .length
                }
              </span>
            </button>
          ))}
        </fieldset>
      )}
      {loading ? (
        <div
          className="adapter-catalog-grid"
          role="status"
          aria-label="Loading adapters"
          aria-busy="true"
        >
          {[0, 1, 2].map((key) => (
            <div className="adapter-catalog-skeleton" key={key} />
          ))}
        </div>
      ) : error ? (
        <div className="marketplace-message" role="alert">
          {error}
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : adapters.length === 0 ? (
        <div className="adapter-catalog-empty">
          <Icon name="plug" size={28} />
          <h2>No adapters installed yet</h2>
          <p>
            Add an adapter to this installation to start connecting your stack.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="adapter-catalog-empty">
          <Icon name="search" size={28} />
          <h2>No matching adapters</h2>
          <p>Try another name, capability or category.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setQuery("");
              setCategory(null);
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="adapter-catalog-grid">
          {visible.map((adapter) => (
            <AdapterCard
              key={adapter.id}
              adapter={adapter}
              connect={() => setSelected(adapter)}
            />
          ))}
        </div>
      )}
      {selected && (
        <ConnectionDialog
          adapter={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
