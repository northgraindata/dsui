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
        "inline-flex min-h-8 items-center justify-center gap-[7px] border border-transparent px-3 text-[12px] font-medium leading-none no-underline transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
        {
          "bg-accent font-semibold text-accent-foreground hover:bg-accent-hover":
            variant === "default",
          "border-border-strong bg-transparent text-primary hover:border-accent-dim hover:bg-surface-hover":
            variant === "secondary",
          "bg-transparent text-secondary before:content-['[_'] before:opacity-45 after:content-['_]'] after:opacity-45 hover:text-accent hover:before:opacity-100 hover:after:opacity-100":
            variant === "ghost",
          "border-unavailable/45 bg-unavailable/10 text-danger-foreground hover:border-unavailable hover:bg-unavailable/15":
            variant === "danger",
          "min-h-[26px] px-[9px] text-[11px]": size === "small",
          "w-8 px-0": size === "icon",
        },
        className,
      )}
      {...props}
    />
  );
}
