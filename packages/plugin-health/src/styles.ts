/** Shared styles for the status page screens, scoped under `.h-page`. */
export const styles = `
.h-page { display: grid; gap: 28px; max-width: 1180px; color: var(--color-secondary); font-size: 12px; }
.h-page a { color: inherit; text-decoration: none; }
.h-page h2 { margin: 0; color: var(--color-primary); font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.h-page p { margin: 0; }
.h-muted { color: var(--color-muted); }

.h-section-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

.h-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 7px; color: var(--color-secondary); background: var(--color-surface); font: inherit; font-size: 11px; cursor: pointer; }
.h-button:hover:not(:disabled) { color: var(--color-primary); border-color: var(--color-border-strong); }
.h-button:disabled { opacity: 0.5; cursor: default; }
.h-button[data-variant=primary] { color: var(--color-primary); border-color: var(--color-border-strong); background: var(--color-surface-raised); }
.h-button[data-variant=danger]:hover:not(:disabled) { color: var(--color-unavailable); border-color: var(--color-unavailable); }
.h-button:focus-visible, .h-page input:focus-visible, .h-page select:focus-visible, .h-page textarea:focus-visible, .h-page a:focus-visible { outline: 2px solid color-mix(in srgb, var(--color-accent) 55%, transparent); outline-offset: 2px; }

.h-field { display: grid; gap: 5px; color: var(--color-muted); font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
.h-field input, .h-field select, .h-field textarea { height: 32px; min-width: 0; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 7px; color: var(--color-primary); background: var(--color-surface); font: inherit; font-size: 12px; letter-spacing: 0; text-transform: none; }
.h-field textarea { height: auto; min-height: 72px; padding: 8px 10px; resize: vertical; }
.h-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 9px; background: var(--color-surface); }
.h-form .h-grow { flex: 1 1 220px; }

.h-card { display: grid; gap: 14px; padding: 16px 18px; border: 1px solid var(--color-border); border-radius: 9px; background: var(--color-surface); }

.h-notice { padding: 11px 14px; border: 1px solid var(--color-border); border-radius: 9px; color: var(--color-secondary); background: var(--color-surface); }
.h-notice[data-tone=error] { color: var(--color-unavailable); border-color: color-mix(in srgb, var(--color-unavailable) 45%, var(--color-border)); }
.h-empty { padding: 32px 20px; border: 1px solid var(--color-border); border-radius: 9px; color: var(--color-muted); text-align: center; }

.h-skeleton { height: 14px; border-radius: 4px; background: linear-gradient(90deg, var(--color-border), var(--color-surface-raised), var(--color-border)); background-size: 200% 100%; animation: h-shimmer 1.4s linear infinite; }
@keyframes h-shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .h-skeleton { animation: none; } }

`;
