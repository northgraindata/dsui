import { Button, cn, Status } from "@northgraindata/dsui-ui";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export const pageClass =
  "mx-auto w-full max-w-5xl flex-1 px-6 py-6 [&_code]:font-mono";

export function PageHeading({
  title,
  detail,
  aside,
}: {
  title: string;
  detail?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-6">
      <div>
        <h1 className="mt-1 text-[17px] font-semibold text-primary">{title}</h1>
        {detail && (
          <p className="mt-1 max-w-xl text-[12px] text-secondary">{detail}</p>
        )}
      </div>
      {aside}
    </div>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="grid place-items-center gap-1.5 border border-dashed border-border bg-surface/50 px-6 py-12 text-center">
      <span className="text-muted">
        <Icon name="database" size={24} />
      </span>
      <h2 className="m-0 text-[13.5px] font-medium text-primary">{title}</h2>
      <p className="m-0 max-w-md text-[11.5px] text-secondary">{detail}</p>
    </div>
  );
}

export function UnavailableState({ detail }: { detail: string }) {
  return (
    <div
      className="grid place-items-center gap-2 border border-unavailable/40 bg-unavailable/[0.06] px-6 py-12 text-center"
      role="alert"
    >
      <Status state="unavailable" label="API unavailable" />
      <h2 className="m-0 text-[14px] font-semibold text-primary">
        dsui could not load this data
      </h2>
      <p className="m-0 max-w-md break-words font-mono text-[11px] text-secondary">
        {detail}
      </p>
      <Button
        variant="secondary"
        size="small"
        onClick={() => window.location.reload()}
      >
        Retry
      </Button>
    </div>
  );
}

export function Page({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(pageClass, className)}>{children}</div>;
}
