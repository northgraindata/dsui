import { Toaster as SonnerToaster, toast } from "sonner";
import type { Notify, NotifyOptions } from "../kit";

/** Sonner reads its colours from these variables. */
const COLORS = {
  "--normal-bg": "var(--color-surface-raised)",
  "--normal-border": "var(--color-border-strong)",
  "--normal-text": "var(--color-primary)",
  "--success-bg": "var(--color-surface-raised)",
  "--success-border":
    "color-mix(in srgb, var(--color-healthy) 55%, transparent)",
  "--success-text": "var(--color-primary)",
  "--error-bg": "var(--color-surface-raised)",
  "--error-border":
    "color-mix(in srgb, var(--color-unavailable) 70%, transparent)",
  "--error-text": "var(--color-primary)",
} as React.CSSProperties;

/** Mounted once by the host, at the root. A second one duplicates toasts. */
export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      richColors
      closeButton
      position="bottom-right"
      style={COLORS}
    />
  );
}

/**
 * Toasts for results that are not visible on screen, and for failed actions.
 * An error stays until dismissed. Calls with the same `id` update one toast,
 * so a repeating failure never builds a stack; without an `id`, the message
 * itself identifies it.
 */
export const notify: Notify = {
  success(message: string, options: NotifyOptions = {}) {
    toast.success(message, {
      id: options.id ?? `success:${message}`,
      description: options.description,
    });
  },
  error(message: string, options: NotifyOptions = {}) {
    toast.error(message, {
      id: options.id ?? `error:${message}`,
      description: options.description,
      duration: Number.POSITIVE_INFINITY,
      ...(options.action ? { action: options.action } : {}),
    });
  },
  dismiss(id: string) {
    toast.dismiss(id);
  },
};
