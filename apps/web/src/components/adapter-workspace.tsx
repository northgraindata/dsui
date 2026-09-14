import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Service } from "../api";
import { navigablePagePaths } from "../service-pages";
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
  paths,
  path,
  children,
}: {
  service: Service;
  paths: string[];
  path?: string;
  children: ReactNode;
}) {
  const pages = navigablePagePaths(paths);
  const query = path === "/query";
  const active = (item: string) =>
    item === path || (item !== "/" && path?.startsWith(`${item}/`));
  const pageLink = (item: string, icons: boolean) => (
    <Link
      key={item}
      activeOptions={{ exact: true }}
      to="/services/$serviceId/$"
      params={{ serviceId: service.id, _splat: item.slice(1) }}
      aria-current={active(item) ? "page" : undefined}
    >
      {icons && <Icon name={pageIcon(item)} />}
      {pageLabel(item)}
    </Link>
  );

  return (
    <div className="adapter-layout">
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
        <nav className="adapter-pages" aria-label="Adapter pages">
          {pages.map((item) => pageLink(item, true))}
        </nav>
      </aside>
      <div className="adapter-main">
        <header className="adapter-heading flex items-center justify-between">
          <div className="adapter-heading-identity">
            <ServiceMark
              adapter={service.adapter}
              logo={service.logo}
              size={64}
            />
            <div>
              <h1>{service.name}</h1>
              <p>
                {query
                  ? `Query, explore and analyze your data with ${service.name}.`
                  : "Explore your data, browse schemas, tables and files."}
              </p>
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
