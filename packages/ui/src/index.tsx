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
        "ui-button",
        `ui-button--${variant}`,
        `ui-button--${size}`,
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
  return <input className={cn("ui-input", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  children,
}: PropsWithChildren<{ label: string; hint?: string; error?: string }>) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the bound control is passed in as children
    <label className="ui-field">
      <span className="ui-field__label">{label}</span>
      {children}
      {error ? (
        <span className="ui-field__error">{error}</span>
      ) : hint ? (
        <span className="ui-field__hint">{hint}</span>
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
    <span className={cn("ui-status", `ui-status--${state}`)}>
      <i aria-hidden="true" />
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
    <section className={cn("ui-surface", className)} {...props}>
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
      <Dialog.Overlay className="ui-dialog__overlay" />
      <Dialog.Content className="ui-dialog">
        <div className="ui-dialog__header">
          <div>
            <Dialog.Title>{title}</Dialog.Title>
            {description && (
              <Dialog.Description>{description}</Dialog.Description>
            )}
          </div>
          <Dialog.Close className="ui-dialog__close" aria-label="Close">
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
