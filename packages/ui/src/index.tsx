import * as Dialog from "@radix-ui/react-dialog";
import { Slot } from "@radix-ui/react-slot";
import clsx, { type ClassValue } from "clsx";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
} from "react";

export function cn(...values: ClassValue[]) {
  return clsx(values);
}

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
        "inline-flex min-h-8 items-center justify-center gap-[7px] border border-transparent px-3 text-[12px] font-medium leading-none no-underline transition-colors duration-150",
        {
          "bg-accent font-semibold text-[#0a1206] hover:bg-[#a5eb90]":
            variant === "default",
          "border-border-strong bg-transparent text-primary hover:border-muted hover:bg-surface-hover":
            variant === "secondary",
          "bg-transparent text-secondary before:content-['[_'] before:opacity-45 after:content-['_]'] after:opacity-45 hover:text-accent hover:before:opacity-100 hover:after:opacity-100":
            variant === "ghost",
          "border-unavailable/35 bg-unavailable/[0.08] text-[#ff8f88]":
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

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-[34px] w-full border border-border-strong bg-canvas px-2.5 text-primary outline-none placeholder:text-muted hover:border-muted focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: PropsWithChildren<{ label: string; hint?: string; error?: string }>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the bound control is passed in as children
    <label className="grid gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-secondary">
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-[11px] text-unavailable">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Status({
  state,
  label,
}: {
  state: "healthy" | "warning" | "unavailable" | "unknown";
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-[7px] whitespace-nowrap text-[11px] lowercase text-secondary">
      <i
        aria-hidden="true"
        className={cn("size-1.5", {
          "bg-healthy": state === "healthy",
          "bg-warning": state === "warning",
          "bg-unavailable": state === "unavailable",
          "bg-unknown": state === "unknown",
        })}
      />
      {label ?? state}
    </span>
  );
}
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
export function DialogContent({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-[#040603]/[0.78]" />
      <Dialog.Content className="fixed top-1/2 left-1/2 z-[51] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 border border-border-strong bg-surface-raised p-5 shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
        <div className="mb-[18px] flex justify-between gap-5 border-b border-dashed border-border pb-[14px] [&_h2]:m-0 [&_h2]:text-[15px] [&_p]:mt-[5px] [&_p]:mb-0 [&_p]:text-[12px] [&_p]:text-secondary">
          <div>
            <Dialog.Title>{title}</Dialog.Title>
            {description && (
              <Dialog.Description>{description}</Dialog.Description>
            )}
          </div>
          <Dialog.Close
            className="border-0 bg-transparent text-[22px] leading-none text-secondary"
            aria-label="Close"
          >
            ×
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
export type { ReactNode };
export { Dialog };
