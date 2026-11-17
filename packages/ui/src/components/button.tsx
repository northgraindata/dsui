import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export function Button({
  className,
  variant = "default",
  size = "default",
  asChild,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "ghost" | "danger";
  size?: "default" | "small" | "icon";
  asChild?: boolean;
}) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control border border-transparent font-medium leading-none no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent not-disabled:active:brightness-90 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-45",
        {
          "min-h-control text-[12px]": size !== "small",
          "px-3": size === "default",
          "bg-accent font-semibold text-accent-foreground not-disabled:hover:bg-accent-hover":
            variant === "default",
          "border-border bg-surface text-primary not-disabled:hover:border-border-strong not-disabled:hover:bg-surface-hover":
            variant === "secondary",
          "bg-transparent text-secondary not-disabled:hover:bg-surface-hover not-disabled:hover:text-primary":
            variant === "ghost",
          "border-unavailable/45 bg-unavailable/10 text-danger-foreground not-disabled:hover:border-unavailable not-disabled:hover:bg-unavailable/15":
            variant === "danger",
          "min-h-[26px] px-[9px] text-[11px]": size === "small",
          "w-control px-0": size === "icon",
        },
        className,
      )}
      {...props}
    />
  );
}
