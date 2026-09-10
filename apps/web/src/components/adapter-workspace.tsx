import { Button } from "@northgraindata/dsui-ui";
import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { deleteService, type Service } from "../api";
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
  const router = useRouter();
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

  const handleRemove = async () => {
    if (confirm(`Are you sure you want to remove ${service.name}?`)) {
      await deleteService(service.id);
      router.navigate({ to: "/" });
    }
  };

  return (
    <div className="adapter-layout">
      <aside className="adapter-sidebar">
        <Link to="/services" className="adapter-back">
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
        <section className="adapter-recent">
          <header>
            <h2>{query ? "Recent queries" : "Recent"}</h2>
            {pages.includes("/activity") && (
              <Link
                to="/services/$serviceId/$viewId"
                params={{ serviceId: service.id, viewId: "activity" }}
              >
                View all
              </Link>
            )}
          </header>
          <p>Open Activity to browse query history for this connection.</p>
          <div className="notebook-preview">
            <Icon name="file" />
            <span>Notebooks</span>
            <small>Coming soon</small>
          </div>
        </section>
        <Link to="/services/$serviceId/$" params={{ serviceId: service.id, _splat: "" }} className="adapter-connection-card">
          <Icon name="database" size={22} />
          <span><strong>{service.endpoint?.split("/").at(-1) || service.name}</strong><small>{service.endpoint || "No endpoint provided"}</small></span>
          <Icon name="chevron" size={14} />
        </Link>
      </aside>
      <div className="adapter-main">
        <header className="adapter-heading flex items-center justify-between">
          <div className="adapter-heading-identity">
            <ServiceMark
              adapter={service.adapter}
              logo={service.logo}
              size={50}
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
          <Button variant="danger" onClick={handleRemove}>
            Remove connection
          </Button>
        </header>
        {children}
      </div>
    </div>
  );
}
