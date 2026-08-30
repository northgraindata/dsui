import { cn, Status } from "@northgraindata/dsui-ui";
import { Link } from "@tanstack/react-router";
import type { Service } from "../api";
import { Icon } from "./Icon";
import { ServiceMark } from "./ServiceMark";

const rowGrid =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[minmax(0,1fr)_130px_170px_16px] md:gap-4";

export function ServiceRow({ service }: { service: Service }) {
  return (
    <Link
      to="/services/$serviceId"
      params={{ serviceId: service.id }}
      className={cn(
        rowGrid,
        "group border-l-2 border-transparent px-4 py-3 no-underline transition-colors hover:border-accent hover:bg-surface-hover",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <ServiceMark adapter={service.adapter} logo={service.logo} />
        <div className="min-w-0 leading-tight">
          <b className="block truncate text-[12.5px] font-medium text-primary">
            {service.name}
          </b>
          <code className="mt-1 block truncate font-mono text-[10.5px] text-muted">
            {service.endpoint}
          </code>
          <div className="mt-2 flex items-center gap-2 md:hidden">
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-secondary">
              {service.category}
            </span>
            <span className="text-border">/</span>
            <Status state={service.health} />
          </div>
        </div>
      </div>
      <span className="hidden truncate font-mono text-[10.5px] uppercase tracking-[0.08em] text-secondary md:block">
        {service.category}
      </span>
      <div className="hidden min-w-0 md:block">
        <Status state={service.health} label={service.health} />
        <small className="mt-1 block truncate font-mono text-[10px] text-muted">
          {service.latencyMs
            ? `${service.latencyMs}ms`
            : (service.detail ?? "")}
        </small>
      </div>
      <span className="text-muted transition-colors group-hover:text-accent">
        <Icon name="chevron" />
      </span>
    </Link>
  );
}
