import type { ComponentProps } from "react";
import { cn } from "./cn";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "min-h-[34px] w-full border border-border-strong bg-background px-2.5 text-primary outline-none placeholder:text-muted transition-colors hover:border-accent-dim focus:border-accent focus:ring-1 focus:ring-accent/25",
        className,
      )}
      {...props}
    />
  );
}
