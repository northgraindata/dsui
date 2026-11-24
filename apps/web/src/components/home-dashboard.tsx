import { Button, Dialog, DialogContent } from "@northgraindata/dsui-ui";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { deleteService, type Service } from "../api";
import type { RecentAdapterPage } from "../features/adapter-workspace/recent-adapter-page";
import {
  PluginSlot,
  usePluginSlotBatch,
} from "../features/plugins/plugin-slots";
import { pageLabel } from "../service-pages";
import { Icon } from "./icon";
import { ServiceMark } from "./service-mark";

const healthPriority = { unavailable: 0, warning: 1, healthy: 2, unknown: 2 };
const healthLabel = {
  unavailable: "Unavailable",
  warning: "Needs attention",
  healthy: "Connected",
  unknown: "Status unknown",
};

function ResumeAdapterPage({
  service,
  page,
}: {
  service: Service;
  page: RecentAdapterPage;
}) {
  const label = pageLabel(page.path);
  return (
    <Link from="/" href={page.href} className="home-resume">
      <ServiceMark
        adapter={service.adapter}
        logo={service.logo}
        size={42}
        fallback="icon"
      />
      <span className="home-resume-copy">
        <strong>Continue where you left off</strong>
        <span title={`${service.name} → ${label}`}>
          {service.name} <span aria-hidden="true">→</span> {label}
        </span>
      </span>
      <Icon name="chevron" size={16} />
    </Link>
  );
}

export function HomeDashboard({
  services,
  loading,
  error,
  recentPage,
  onServiceRemoved,
  onRefresh,
}: {
  services: Service[];
  loading: boolean;
  error?: string;
  recentPage?: RecentAdapterPage;
  onServiceRemoved?: (id: string) => void;
  onRefresh?: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<string>();
  const [removeService, setRemoveService] = useState<Service>();
  const [settingsService, setSettingsService] = useState<Service>();
  const [removing, setRemoving] = useState(false);
  const pluginSlots = usePluginSlotBatch(
    "dashboard.service-card.trailing",
    services.map((service) => service.id).join("\0"),
  );
  const resumeService = services.find(
    (service) => service.id === recentPage?.serviceId,
  );
  const sortedServices = [...services].sort(
    (a, b) => healthPriority[a.health] - healthPriority[b.health],
  );
  const isEmpty = !loading && !error && services.length === 0;
  return (
    <div className="home-dashboard">
      {recentPage && resumeService && (
        <ResumeAdapterPage service={resumeService} page={recentPage} />
      )}
      <section className="stack-panel" aria-labelledby="home-adapters-heading">
        <header>
          <h1 id="home-adapters-heading">Adapters</h1>
          <div className="stack-actions">
            <button
              type="button"
              className="outline-action"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh connected adapters"
            >
              <Icon name="refresh" />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            {!isEmpty && (
              <Link to="/services/new" className="outline-action">
                <Icon name="plus" />
                Connect adapter
              </Link>
            )}
          </div>
        </header>
        {error && (
          <p role="alert" className="dashboard-error">
            {error}
          </p>
        )}
        <div
          className="stack-cards"
          data-dsui-overlay-target="dashboard.services"
          aria-busy={loading}
        >
          {loading && (
            <p className="stack-message" role="status">
              Checking your services…
            </p>
          )}
          {isEmpty && (
            <div className="stack-empty">
              <Icon name="plug" size={24} />
              <h2>No adapters connected yet</h2>
              <p>
                Connect an adapter to explore data and manage your services from
                DSUI.
              </p>
              <Button asChild>
                <Link to="/services/new">
                  <Icon name="plus" />
                  Connect adapter
                </Link>
              </Button>
            </div>
          )}
          {sortedServices.map((service) => (
            <article
              key={service.id}
              className="stack-card"
              data-health={service.health}
              data-dsui-overlay-target={`dashboard.service.${service.id}`}
            >
              <Link
                to="/services/$serviceId"
                params={{ serviceId: service.id }}
                className="stack-card-main"
                title={service.endpoint}
              >
                <ServiceMark
                  adapter={service.adapter}
                  logo={service.logo}
                  size={42}
                  fallback="icon"
                />
                <div className="stack-card-identity">
                  <div className="stack-card-title">
                    <h3>{service.name}</h3>
                    <Icon name="chevron" size={14} />
                  </div>
                  <span className="stack-card-status">
                    <i className="health-dot" data-health={service.health} />
                    {healthLabel[service.health]}
                  </span>
                </div>
              </Link>
              <div className="stack-card-footer">
                <div className="stack-card-detail">
                  {service.endpoint && <p>{service.endpoint}</p>}
                  {service.detail && (
                    <small title={service.detail}>{service.detail}</small>
                  )}
                </div>
                <div className="stack-card-slot">
                  <PluginSlot
                    serviceId={service.id}
                    results={pluginSlots.results}
                    error={pluginSlots.error}
                  />
                </div>
              </div>
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
