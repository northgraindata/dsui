import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "./cn";

export function Surface({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return (
    <section
      className={cn(
        "relative border border-border bg-surface before:pointer-events-none before:absolute before:top-0 before:left-0 before:size-[7px] before:border-t before:border-l before:border-border-strong after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:size-[7px] after:border-r after:border-b after:border-border-strong",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
