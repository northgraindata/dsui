import type { PropsWithChildren } from "react";

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
