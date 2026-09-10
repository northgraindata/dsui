import { Button } from "@northgraindata/dsui-ui";
import { useEffect, useState } from "react";
import { type Adapter, getAdapters } from "../api";
import { ConnectionDialog } from "./connection-dialog";
import { ServiceMark } from "./service-mark";

export function AdapterMarketplace() {
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [selected, setSelected] = useState<Adapter | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    getAdapters()
      .then((result) => {
        if (active) setAdapters(result);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load adapters.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="adapter-marketplace">
      <header className="marketplace-heading">
        <div>
          <h1>Adapters</h1>
          <p>Connect and manage your data stack.</p>
        </div>
      </header>
      {error ? (
        <p className="marketplace-message" role="alert">
          {error}
        </p>
      ) : loading ? (
        <div
          className="marketplace-grid"
          role="status"
          aria-label="Loading adapters"
          aria-busy="true"
        >
          {[0, 1, 2].map((key) => (
            <div className="marketplace-skeleton" key={key} />
          ))}
        </div>
      ) : adapters.length === 0 ? (
        <p className="marketplace-message">
          No adapters are installed. Add an adapter to your dsui configuration
          to get started.
        </p>
      ) : (
        <div className="marketplace-grid">
          {adapters.map((adapter) => (
            <article className="marketplace-card" key={adapter.id}>
              <div className="marketplace-card-identity">
                <ServiceMark
                  adapter={adapter.id}
                  logo={adapter.logo}
                  size={44}
                  variant="bare"
                />
                <div>
                  <h2>{adapter.name}</h2>
                  <p>{adapter.description}</p>
                </div>
              </div>
              <Button
                variant="secondary"
                aria-label={`Connect ${adapter.name}`}
                onClick={() => setSelected(adapter)}
              >
                Connect
              </Button>
            </article>
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
