import { cn, Status } from "@northgraindata/dsui-ui";
import { Link } from "@tanstack/react-router";
import type { Service } from "../api";
import { Icon } from "./Icon";
import { ServiceMark } from "./ServiceMark";

const rowGrid =
  "grid grid-cols-[minmax(0,1fr)_140px_190px_16px] items-center gap-3";

export function ServiceRow({ service }: { service: Service }) {
  return (
    <Link
      to="/services/$serviceId"
      params={{ serviceId: service.id }}
      className={cn(
        rowGrid,
        "group px-4 py-2.5 no-underline transition-colors hover:bg-surface-hover",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <ServiceMark adapter={service.adapter} logo={service.logo} />
        <div className="min-w-0 leading-tight">
          <b className="block truncate text-[12.5px] font-medium text-primary">
            {service.name}
          </b>
          <code className="block truncate font-mono text-[11px] text-muted">
            {service.endpoint}
          </code>
        </div>
      </div>
      <span className="truncate text-[11.5px] text-secondary">
        {service.category}
      </span>
      <div className="min-w-0">
        <Status state={service.health} label={service.health} />
        <small className="mt-0.5 block truncate font-mono text-[10.5px] text-muted">
          {service.latencyMs
            ? `${service.latencyMs}ms`
            : (service.detail ?? "")}
        </small>
      </div>
      <Icon name="chevron" />
    </Link>
  );
}
