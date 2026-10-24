import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Service } from "../api";
import {
  PluginSlot,
  usePluginSlotBatch,
} from "../features/plugins/plugin-slots";
import { navigablePagePaths } from "../service-pages";
import { AdapterTabs } from "./adapter-tabs";
import { Icon } from "./icon";
import { ServiceMark } from "./service-mark";

function pageLabel(path: string) {
  if (path === "/") return "Overview";
  if (path === "/data") return "Explorer";
  const label =
    path.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ?? "Overview";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function pageIcon(path: string) {
  return (
    {
      "/": "home",
      "/query": "play",
      "/data": "folder",
      "/tables": "table",
      "/schemas": "schema",
      "/extensions": "layers",
      "/files": "file",
      "/activity": "activity",
    }[path] ?? "grid"
  );
}

export function AdapterWorkspace({
  service,
  services,
  paths,
  path,
  children,
  embedded = false,
  secondary,
  onSelectPage,
}: {
  service: Service;
  services: Service[];
  paths: string[];
  path?: string;
  children: ReactNode;
  embedded?: boolean;
  secondary?: ReactNode;
  onSelectPage?: (path: string) => void;
}) {
  const pages = navigablePagePaths(paths);
  const pluginSlots = usePluginSlotBatch(
    "service.workspace.after-header",
    service.id,
  );
  const active = (item: string) =>
    item === path || (item !== "/" && path?.startsWith(`${item}/`));
  const pageLink = (item: string, icons: boolean) => (
    <Link
      key={item}
      data-dsui-overlay-target={`service.workspace.page.${item === "/" ? "overview" : item.slice(1)}`}
      activeOptions={{ exact: true }}
      to="/services/$serviceId/$"
      params={{ serviceId: service.id, _splat: item.slice(1) }}
      aria-current={active(item) ? "page" : undefined}
      aria-label={pageLabel(item)}
      title={pageLabel(item)}
    >
      {icons && <Icon name={pageIcon(item)} />}
      <span>{pageLabel(item)}</span>
    </Link>
  );

  const content = (
    <div className="adapter-main-content">
      <header
        className="adapter-heading flex items-center justify-between"
        data-dsui-overlay-target="service.workspace.header"
      >
        <div className="adapter-heading-identity">
          <ServiceMark
            adapter={service.adapter}
            logo={service.logo}
            size={embedded ? 44 : 64}
          />
          <div>
            <h1>{service.name}</h1>
            {!embedded && (
              <p>Explore your data, browse schemas, tables and files.</p>
            )}
          </div>
        </div>
        {(embedded || secondary) && (
          <div className="adapter-pane-actions">
            <select
              aria-label={`${service.name} page`}
              value={pages.find(active) ?? pages[0] ?? ""}
              onChange={(event) => onSelectPage?.(event.target.value)}
            >
              {pages.map((item) => (
                <option key={item} value={item}>
                  {pageLabel(item)}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>
      <PluginSlot
        serviceId={service.id}
        results={pluginSlots.results}
        error={pluginSlots.error}
      />
      <div data-dsui-overlay-target="service.workspace.content">{children}</div>
    </div>
  );

  return (
    <div
      className="adapter-layout"
      data-split={Boolean(secondary)}
      data-embedded={embedded}
    >
      {!embedded && (
        <aside className="adapter-sidebar">
          <Link to="/" className="adapter-back">
            <Icon name="chevron" size={14} />
            Back to home
          </Link>
          <div className="adapter-identity">
            <ServiceMark
              adapter={service.adapter}
              logo={service.logo}
              size={48}
            />
            <div>
              <strong>{service.name}</strong>
              <small>
                <span className="health-dot" data-health={service.health} />
                {service.health === "healthy" ? "Connected" : service.health}
              </small>
            </div>
          </div>
          <nav
            className="adapter-pages"
            aria-label="Adapter pages"
            data-dsui-overlay-target="service.workspace.navigation"
          >
            {pages.map((item) => pageLink(item, true))}
          </nav>
        </aside>
      )}
      <div className="adapter-main">
        {!embedded && (
          <AdapterTabs services={services} activeServiceId={service.id} />
        )}
        {secondary ? (
          <div className="adapter-pane-grid">
            {content}
            <div className="adapter-secondary-pane">{secondary}</div>
          </div>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
