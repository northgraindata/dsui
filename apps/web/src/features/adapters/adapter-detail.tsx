import { Button } from "@northgraindata/dsui-ui";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { type Adapter, getServices, type Service } from "../../api";
import { ConnectionDialog } from "../../components/connection-dialog";
import { Icon } from "../../components/icon";
import { ServiceMark } from "../../components/service-mark";
import { SERVICE_CONNECTIONS_CHANGED } from "../../service-events";
import { useAdapterCatalog } from "./use-adapter-catalog";
import "./adapter-catalog.css";
import "./adapter-detail.css";

const linkIcons = { website: "globe", documentation: "book", source: "braces" };

function AdapterConnections({ adapter }: { adapter: Adapter }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retrying reloads visible connections.
  useEffect(() => {
    let active = true;
    let generation = 0;
    const isCurrent = (request: number) => active && request === generation;
    const load = async () => {
      const request = ++generation;
      try {
        const items = await getServices();
        if (!isCurrent(request)) return;
        setServices(items.filter((service) => service.adapter === adapter.id));
        setError(false);
      } catch {
        if (isCurrent(request)) setError(true);
      } finally {
        if (isCurrent(request)) setLoading(false);
      }
    };
    void load();
    window.addEventListener(SERVICE_CONNECTIONS_CHANGED, load);
    return () => {
      active = false;
      window.removeEventListener(SERVICE_CONNECTIONS_CHANGED, load);
    };
  }, [adapter.id, attempt]);
  return (
    <section className="adapter-detail-section adapter-your-connections">
      <div className="adapter-section-heading">
        <h2>Connections</h2>
        {!loading && !error && <span>{services.length}</span>}
      </div>
      {loading ? (
        <p role="status">Loading connections…</p>
      ) : error ? (
        <div role="status">
          <p>Could not load your connections.</p>
          <Button
            variant="secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </Button>
        </div>
      ) : services.length ? (
        <div className="adapter-connected-list">
          {services.map((service) => (
            <Link
              key={service.id}
              to="/services/$serviceId"
              params={{ serviceId: service.id }}
            >
              <ServiceMark
                adapter={service.adapter}
                logo={service.logo}
                size={30}
                variant="bare"
              />
              <span>{service.name}</span>
              <span className="adapter-connection-status">
                <i className="health-dot" data-health={service.health} />
                {service.health}
              </span>
              <Icon name="chevron" size={14} />
            </Link>
          ))}
        </div>
      ) : (
        <p>No connections yet.</p>
      )}
    </section>
  );
}

function ConnectionSections({ adapter }: { adapter: Adapter }) {
  const presentation = adapter.presentation;
  return (
    <>
      {!!adapter.connectionMethods?.length && (
        <section className="adapter-detail-section">
          <h2>Connection methods</h2>
          <div className="adapter-methods">
            {adapter.connectionMethods.map((method) => (
              <article key={method.id}>
                <Icon name="plug" size={17} />
                <div>
                  <h3>{method.label}</h3>
                  {method.group && (
                    <span className="adapter-method-group">
                      {method.group.label}
                    </span>
                  )}
                  {method.description && <p>{method.description}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {!!presentation?.compatibility?.length && (
        <section className="adapter-detail-section">
          <h2>Compatibility</h2>
          <ul className="adapter-detail-notes">
            {presentation.compatibility.map((note) => (
              <li key={note}>
                <Icon name="check" size={15} />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!presentation?.limitations?.length && (
        <section className="adapter-detail-section">
          <h2>Requirements & limitations</h2>
          <ul className="adapter-detail-notes">
            {presentation.limitations.map((note) => (
              <li key={note}>
                <Icon name="info" size={15} />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function AdapterConnectPanel({
  adapter,
  connect,
}: {
  adapter: Adapter;
  connect(): void;
}) {
  const unavailable = adapter.status === "unavailable";
  return (
    <aside
      className="adapter-connect-panel"
      aria-label={`${adapter.name} setup`}
    >
      <Button disabled={unavailable} onClick={connect}>
        Connect {adapter.name}
        <Icon name="plus" size={15} />
      </Button>
      {unavailable && (
        <p className="adapter-unavailable" role="status">
          {adapter.detail ??
            "This adapter is unavailable. Check the installation before connecting."}
        </p>
      )}
      {(adapter.version || adapter.author) && (
        <dl>
          {adapter.author && (
            <div>
              <dt>Maintainer</dt>
              <dd>{adapter.author}</dd>
            </div>
          )}
          {adapter.version && (
            <div>
              <dt>Version</dt>
              <dd>{adapter.version}</dd>
            </div>
          )}
        </dl>
      )}
      {!!adapter.presentation?.links?.length && (
        <div className="adapter-resource-links">
          <h3>Links</h3>
          {adapter.presentation.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Icon name={linkIcons[link.kind ?? "website"]} size={15} />
              <span>{link.label}</span>
              <span className="adapter-resource-external" aria-hidden="true">
                ↗
              </span>
            </a>
          ))}
        </div>
      )}
    </aside>
  );
}

export function AdapterDetailScreen() {
  const { adapterId } = useParams({ from: "/adapters/$adapterId" });
  const { adapters, loading, error, retry } = useAdapterCatalog();
  const [connecting, setConnecting] = useState<string>();
  const adapter = adapters.find((item) => item.id === adapterId);
  const back = (
    <Link className="adapter-catalog-back" to="/services">
      <Icon name="chevron" size={14} />
      <span>All adapters</span>
    </Link>
  );
  if (loading)
    return (
      <div className="adapter-detail">
        {back}
        <p className="marketplace-message" role="status">
          Loading adapter…
        </p>
      </div>
    );
  if (error)
    return (
      <div className="adapter-detail">
        {back}
        <div className="marketplace-message" role="alert">
          {error}
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      </div>
    );
  if (!adapter)
    return (
      <div className="adapter-detail">
        {back}
        <div className="adapter-catalog-empty">
          <h1>Adapter not found</h1>
          <p>This adapter is not available in this installation.</p>
        </div>
      </div>
    );
  return (
    <div className="adapter-detail">
      {back}
      <header className="adapter-detail-heading">
        <div className="adapter-detail-brand">
          <ServiceMark
            adapter={adapter.id}
            logo={adapter.logo}
            size={48}
            variant="bare"
          />
          <div>
            <span className="adapter-category">{adapter.category}</span>
            <h1>{adapter.name}</h1>
          </div>
        </div>
        <p>{adapter.presentation?.overview ?? adapter.description}</p>
      </header>
      <div className="adapter-detail-layout">
        <div className="adapter-detail-main">
          <ConnectionSections adapter={adapter} />
          <AdapterConnections key={adapter.id} adapter={adapter} />
        </div>
        <AdapterConnectPanel
          adapter={adapter}
          connect={() => setConnecting(adapter.id)}
        />
      </div>
      {connecting === adapter.id && (
        <ConnectionDialog
          adapter={adapter}
          onClose={() => setConnecting(undefined)}
        />
      )}
    </div>
  );
}
