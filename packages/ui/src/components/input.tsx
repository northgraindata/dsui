import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-control w-full rounded-control border border-border bg-surface px-2.5 text-[12px] text-primary outline-none placeholder:text-muted transition-colors enabled:hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-unavailable aria-invalid:focus:border-unavailable aria-invalid:enabled:hover:border-unavailable aria-invalid:focus:ring-unavailable/15 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}
