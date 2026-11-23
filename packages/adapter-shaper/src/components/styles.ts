import type { CSSProperties } from "react";

export const cardStyle: CSSProperties = {
  padding: 14,
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  minWidth: 0,
};

export const titleStyle: CSSProperties = {
  margin: "0 0 10px",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-muted)",
};

export const mutedStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--color-muted)",
};

export const buttonStyle: CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  color: "var(--color-secondary)",
  background: "var(--color-surface-raised)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 6,
  cursor: "pointer",
};

export const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  color: "var(--color-accent-foreground)",
  background: "var(--color-accent)",
  border: "1px solid var(--color-accent)",
};

export const fieldStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  fontSize: 13,
  color: "var(--color-primary)",
  background: "var(--color-surface-raised)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: 6,
};
