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
        "relative rounded-xl border border-border bg-surface",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
