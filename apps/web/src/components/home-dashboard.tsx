import { Button, Dialog, DialogContent } from "@northgraindata/dsui-ui";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { deleteService, type Service } from "../api";
import { Icon } from "./icon";
import { ServiceMark } from "./service-mark";

export function HomeDashboard({
  services,
  loading,
  error,
  onServiceRemoved,
  onRefresh,
}: {
  services: Service[];
  loading: boolean;
  error?: string;
  onServiceRemoved?: (id: string) => void;
  onRefresh?: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<string>();
  const [removeService, setRemoveService] = useState<Service>();
  const [settingsService, setSettingsService] = useState<Service>();
  const [removing, setRemoving] = useState(false);
  const connected = services.filter(
    (service) => service.health === "healthy",
  ).length;
  const issues = services.filter(
    (service) =>
      service.health === "unavailable" || service.health === "warning",
  ).length;
  const stats = [
    {
      label: "Connected services",
      value: connected,
      icon: "layers",
      tone: "accent",
    },
    {
      label: "Issues detected",
      value: issues,
      icon: "alert",
      tone: "unavailable",
    },
    {
      label: "Configured adapters",
      value: new Set(services.map((service) => service.adapter)).size,
      icon: "check",
      tone: "healthy",
    },
    {
      label: "Estimated daily cost",
      value: "—",
      icon: "activity",
      tone: "muted",
      detail: "Coming soon",
    },
  ];
  return (
    <div className="home-dashboard">
      <header className="home-heading">
        <div className="home-greeting">
          <span className="greeting-icon">
            <Icon name="sun" size={26} />
          </span>
          <div>
            <h1>Your workspace, at a glance</h1>
            <p>Here's what's happening with your data stack today.</p>
          </div>
        </div>
        <time dateTime={new Date().toISOString().slice(0, 10)}>
          {new Intl.DateTimeFormat(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          }).format(new Date())}
        </time>
      </header>
      {error && (
        <p role="alert" className="dashboard-error">
          {error}
        </p>
      )}
      <div className="home-stats" aria-busy={loading}>
        {stats.map((stat) => (
          <section className="home-stat" key={stat.label}>
            <div>
              <strong>{loading || error ? "—" : stat.value}</strong>
              <p>{stat.label}</p>
            </div>
            <div className={`stat-icon stat-icon--${stat.tone}`}>
              <Icon name={stat.icon} size={22} />
              {stat.detail && <small>{stat.detail}</small>}
            </div>
          </section>
        ))}
      </div>
      <div className="home-panels">
        <section className="stack-panel">
          <header>
            <div>
              <h2>Your data stack</h2>
              <p>All connected services in one place.</p>
            </div>
            <button
              type="button"
              className="outline-action"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh connected services"
            >
              <Icon name="refresh" />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </header>
          <div className="stack-cards" aria-busy={loading}>
            {loading && (
              <p className="stack-loading" role="status">
                Checking your services…
              </p>
            )}
            {services.map((service) => (
              <article key={service.id} className="stack-card">
                <Link
                  to="/services/$serviceId"
                  params={{ serviceId: service.id }}
                  className="stack-card-main"
                >
                  <div className="stack-card-heading">
                    <ServiceMark
                      adapter={service.adapter}
                      logo={service.logo}
                      size={42}
                      variant="bare"
                    />
                    <div>
                      <h3>{service.name}</h3>
                      <span>
                        <i
                          className="health-dot"
                          data-health={service.health}
                        />
                        {service.health === "healthy"
                          ? "Connected"
                          : service.health}
                      </span>
                    </div>
                  </div>
                  <div className="stack-card-detail">
                    <p title={service.endpoint}>
                      {service.endpoint || service.adapter}
                    </p>
                    <small title={service.detail ?? undefined}>
                      {service.detail ??
                        (service.latencyMs !== undefined
                          ? `${service.latencyMs} ms response time`
                          : "Ready to explore")}
                    </small>
                    <Icon name="database" size={21} />
                  </div>
                </Link>
                <div className="stack-card-menu">
                  <button
                    type="button"
                    className="stack-card-menu-trigger"
                    aria-label={`Manage ${service.name}`}
                    aria-expanded={openMenu === service.id}
                    onClick={() =>
                      setOpenMenu((current) =>
                        current === service.id ? undefined : service.id,
                      )
                    }
                  >
                    <span aria-hidden="true">⋯</span>
                  </button>
                  {openMenu === service.id && (
                    <div className="stack-card-menu-popover" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setSettingsService(service);
                          setOpenMenu(undefined);
                        }}
                      >
                        <Icon name="gear" size={15} /> Settings
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="is-danger"
                        onClick={() => {
                          setRemoveService(service);
                          setOpenMenu(undefined);
                        }}
                      >
                        Remove connection
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
        <aside className="home-aside">
          <section className="activity-panel">
            <header>
              <h2>Recent activity</h2>
            </header>
            <div className="activity-empty">
              <span className="greeting-icon">
                <Icon name="activity" size={24} />
              </span>
              <h3>Your stack's story starts here</h3>
              <p>
                Activity across your adapters will appear here. Query history is
                available inside each adapter.
              </p>
              <span className="coming-soon">Coming soon</span>
            </div>
          </section>
          <section className="quick-panel">
            <h2>Quick actions</h2>
            <Link to="/services">
              <Icon name="terminal" />
              Open query editor
              <Icon name="chevron" size={13} />
            </Link>
            <Link to="/services">
              <Icon name="database" />
              Browse data
              <Icon name="chevron" size={13} />
            </Link>
            <Link to="/services/new">
              <Icon name="gear" />
              Manage adapters
              <Icon name="chevron" size={13} />
            </Link>
          </section>
        </aside>
      </div>
      <Dialog.Root
        open={Boolean(removeService)}
        onOpenChange={(open) => !open && setRemoveService(undefined)}
      >
        <DialogContent
          title="Remove connection"
          description={
            removeService
              ? `Are you sure you want to remove ${removeService.name}?`
              : undefined
          }
        >
          <div className="flex justify-end gap-3 pt-5">
            <Button variant="ghost" onClick={() => setRemoveService(undefined)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={removing}
              onClick={async () => {
                if (!removeService) return;
                setRemoving(true);
                try {
                  await deleteService(removeService.id);
                  onServiceRemoved?.(removeService.id);
                  setRemoveService(undefined);
                } finally {
                  setRemoving(false);
                }
              }}
            >
              {removing ? "Removing…" : "Yes, remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(settingsService)}
        onOpenChange={(open) => !open && setSettingsService(undefined)}
      >
        <DialogContent
          title={`${settingsService?.name ?? "Service"} settings`}
          description="Manage this connection and its workspace preferences."
          className="service-settings-dialog"
        >
          <div className="service-settings-layout">
            <nav
              aria-label="Service settings"
              className="service-settings-sidebar"
            >
              <button type="button" className="is-active">
                Connection
              </button>
              <button type="button" disabled>
                Appearance
              </button>
              <button type="button" disabled>
                Danger zone
              </button>
            </nav>
            <section
              className="service-settings-content"
              aria-label="Connection settings"
            >
              <h3>Connection</h3>
              <p>Review the adapter currently connected to your workspace.</p>
              <dl>
                <div>
                  <dt>Adapter</dt>
                  <dd>{settingsService?.adapter}</dd>
                </div>
                <div>
                  <dt>Endpoint</dt>
                  <dd>{settingsService?.endpoint || "Managed by adapter"}</dd>
                </div>
              </dl>
              <Button variant="secondary" disabled>
                Change connection
              </Button>
              <small className="service-settings-note">
                Connection editing will be available here once the service
                update API is enabled.
              </small>
            </section>
          </div>
        </DialogContent>
      </Dialog.Root>
    </div>
  );
}
