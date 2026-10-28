/** Styles for every page the plugin renders, scoped under `.h-page`. */
export const styles = `
.h-page { display: grid; gap: 28px; max-width: 1180px; color: var(--color-secondary); font-size: 12px; }
.h-page a { color: inherit; text-decoration: none; }
.h-page h2 { margin: 0; color: var(--color-primary); font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.h-page p { margin: 0; }
.h-muted { color: var(--color-muted); }
.h-num { font-variant-numeric: tabular-nums; white-space: nowrap; }

.h-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.h-tile { display: grid; gap: 5px; padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 9px; background: var(--color-surface); }
.h-tile strong { color: var(--color-primary); font-size: 22px; font-weight: 600; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.h-tile-label { color: var(--color-muted); font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.h-tile-detail { color: var(--color-muted); font-size: 11px; }
.h-tile[data-status=healthy] strong { color: var(--color-healthy); }
.h-tile[data-status=warning] strong { color: var(--color-warning); }
.h-tile[data-status=unavailable] strong { color: var(--color-unavailable); }

.h-section { display: grid; gap: 14px; }
.h-section > header { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.h-section > header p { margin-top: 4px; color: var(--color-muted); font-size: 11px; }
.h-section-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

.h-pill { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; color: var(--color-secondary); }
.h-pill i { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--color-muted); }
.h-pill[data-status=healthy] { color: var(--color-healthy); }
.h-pill[data-status=healthy] i { background: var(--color-healthy); }
.h-pill[data-status=warning] { color: var(--color-warning); }
.h-pill[data-status=warning] i { background: var(--color-warning); }
.h-pill[data-status=unavailable] { color: var(--color-unavailable); }
.h-pill[data-status=unavailable] i { background: var(--color-unavailable); }
.h-pill[data-status=maintenance] { color: var(--color-accent); }
.h-pill[data-status=maintenance] i { background: var(--color-accent); }

.h-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 7px; color: var(--color-secondary); background: var(--color-surface); font: inherit; font-size: 11px; cursor: pointer; }
.h-button:hover:not(:disabled) { color: var(--color-primary); border-color: var(--color-border-strong); }
.h-button:disabled { opacity: 0.5; cursor: default; }
.h-button[data-variant=primary] { color: var(--color-primary); border-color: var(--color-border-strong); background: var(--color-surface-raised); }
.h-button[data-variant=danger]:hover:not(:disabled) { color: var(--color-unavailable); border-color: var(--color-unavailable); }
.h-button:focus-visible, .h-page input:focus-visible, .h-page select:focus-visible, .h-page textarea:focus-visible, .h-page a:focus-visible { outline: 2px solid color-mix(in srgb, var(--color-accent) 55%, transparent); outline-offset: 2px; }

.h-field { display: grid; gap: 5px; color: var(--color-muted); font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
.h-field input, .h-field select, .h-field textarea, .h-search input { height: 32px; min-width: 0; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 7px; color: var(--color-primary); background: var(--color-surface); font: inherit; font-size: 12px; letter-spacing: 0; text-transform: none; }
.h-field textarea { height: auto; min-height: 72px; padding: 8px 10px; resize: vertical; }
.h-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 9px; background: var(--color-surface); }
.h-form .h-grow { flex: 1 1 220px; }

.h-controls { display: flex; flex-wrap: wrap; gap: 8px; }
.h-search { display: flex; align-items: center; gap: 8px; width: 220px; height: 34px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 7px; color: var(--color-muted); background: var(--color-surface); }
.h-search input { width: 100%; height: 100%; padding: 0; border: 0; outline: 0; background: transparent; }
.h-search:focus-within { border-color: var(--color-accent); }
.h-tabs { min-width: 0; margin: 0; display: inline-flex; padding: 3px; gap: 2px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
.h-tabs button { height: 26px; padding: 0 12px; border: 0; border-radius: 5px; color: var(--color-muted); background: transparent; font: inherit; font-size: 11px; cursor: pointer; }
.h-tabs button[aria-pressed=true] { color: var(--color-primary); background: var(--color-surface-raised); }

.h-table-wrap { max-height: min(680px, 72vh); overflow: auto; border: 1px solid var(--color-border); border-radius: 9px; background: var(--color-surface); }
.h-table { width: 100%; border-collapse: collapse; text-align: left; }
.h-table thead { position: sticky; top: 0; z-index: 1; background: var(--color-surface-raised); }
.h-table th { padding: 11px 16px; border-bottom: 1px solid var(--color-border); color: var(--color-muted); font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.h-table td { padding: 12px 16px; border-bottom: 1px solid var(--color-border); vertical-align: middle; }
.h-table tbody tr:last-child td { border-bottom: 0; }
.h-table tbody tr:hover { background: var(--color-surface-hover); }
.h-table .h-right { text-align: right; }
.h-service { display: flex; align-items: center; gap: 10px; min-width: 190px; }
.h-service img { width: 22px; height: 22px; flex: none; object-fit: contain; }
.h-service strong { display: block; color: var(--color-primary); font-size: 12px; font-weight: 600; }
.h-service span { color: var(--color-muted); font-size: 11px; }
.h-service a:hover strong { color: var(--color-accent); }
.h-since { display: block; margin-top: 3px; color: var(--color-muted); font-size: 10px; }
.h-wrap { max-width: 520px; text-align: right; overflow-wrap: anywhere; }
.h-clip { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.h-strip { display: block; width: 100%; }
.h-strip rect { fill: var(--color-border-strong, #29374c); }
.h-strip rect[data-status=healthy] { fill: var(--color-healthy); }
.h-strip rect[data-status=warning] { fill: var(--color-warning); }
.h-strip rect[data-status=unavailable] { fill: var(--color-unavailable); }
.h-strip rect[data-status=unknown] { fill: var(--color-muted); }
.h-strip rect[data-status=maintenance] { fill: var(--color-accent); }
.h-strip rect[data-status=missing] { fill: var(--color-border-strong, #29374c); opacity: 0.45; }
.h-strip-cell { min-width: 150px; width: 190px; }

.h-card { display: grid; gap: 14px; padding: 16px 18px; border: 1px solid var(--color-border); border-radius: 9px; background: var(--color-surface); }
.h-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
.h-header-title { display: flex; align-items: center; gap: 14px; }
.h-header-title img { width: 34px; height: 34px; object-fit: contain; }
.h-header-title h1 { margin: 0; color: var(--color-primary); font-size: 22px; font-weight: 650; letter-spacing: -0.03em; }
.h-header-title p { margin-top: 4px; color: var(--color-muted); }
.h-facts { display: flex; flex-wrap: wrap; gap: 6px 24px; color: var(--color-muted); font-size: 11px; }
.h-facts b { color: var(--color-secondary); font-weight: 500; }
.h-breadcrumb { color: var(--color-muted); font-size: 11px; }
.h-breadcrumb a:hover { color: var(--color-primary); }

.h-chart svg { display: block; width: 100%; height: auto; }
.h-chart text { fill: var(--color-muted); font-size: 9px; }
.h-chart-grid { stroke: var(--color-border); stroke-width: 1; }
.h-chart-average, .h-chart-dot { fill: var(--color-accent); }
.h-chart-p95 { fill: none; stroke-width: 1.6; stroke-linejoin: round; }
.h-chart-average { stroke: var(--color-accent); }
.h-chart-p95 { stroke: var(--color-warning); stroke-dasharray: 3 3; opacity: 0.85; }
.h-legend { display: flex; gap: 16px; margin-top: 6px; color: var(--color-muted); font-size: 10px; }
.h-legend span::before { display: inline-block; width: 14px; height: 0; margin-right: 6px; border-top: 2px solid var(--color-accent); vertical-align: middle; content: ""; }
.h-legend [data-series=p95]::before { border-top: 2px dashed var(--color-warning); }

.h-checks { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; border: 1px solid var(--color-border); border-radius: 9px; background: var(--color-surface); }
.h-checks li { display: grid; grid-template-columns: 18px 1fr auto; align-items: baseline; gap: 10px; padding: 11px 16px; border-bottom: 1px solid var(--color-border); }
.h-checks li:last-child { border-bottom: 0; }
.h-checks strong { color: var(--color-primary); font-weight: 500; }
.h-mark { width: 8px; height: 8px; margin-top: 3px; border-radius: 50%; background: var(--color-healthy); }
.h-mark[data-ok=false], .h-mark[data-tone=error] { background: var(--color-unavailable); }
.h-mark[data-tone=warning] { background: var(--color-warning); }
.h-mark[data-tone=info] { background: var(--color-muted); }
.h-link { color: var(--color-accent); text-decoration: underline; text-underline-offset: 3px; }
.h-link:hover { color: var(--color-primary); }

.h-budget { height: 6px; overflow: hidden; border-radius: 3px; background: var(--color-border); }
.h-budget span { display: block; height: 100%; border-radius: 3px; background: var(--color-healthy); }
.h-budget[data-level=low] span { background: var(--color-warning); }
.h-budget[data-level=spent] span { background: var(--color-unavailable); }

.h-timeline { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.h-timeline li { position: relative; display: grid; gap: 3px; padding: 0 0 18px 22px; }
.h-timeline li::before { position: absolute; top: 5px; left: 0; width: 8px; height: 8px; border-radius: 50%; background: var(--color-muted); content: ""; }
.h-timeline li::after { position: absolute; top: 16px; bottom: 0; left: 3.5px; width: 1px; background: var(--color-border); content: ""; }
.h-timeline li:last-child { padding-bottom: 0; }
.h-timeline li:last-child::after { display: none; }
.h-timeline [data-kind=opened]::before, .h-timeline [data-kind=reopened]::before, .h-timeline [data-kind=escalated]::before { background: var(--color-unavailable); }
.h-timeline [data-kind=deescalated]::before { background: var(--color-warning); }
.h-timeline [data-kind=resolved]::before { background: var(--color-healthy); }
.h-timeline [data-kind=acknowledged]::before { background: var(--color-accent); }
.h-timeline strong { color: var(--color-primary); font-weight: 500; }
.h-timeline time { color: var(--color-muted); font-size: 10px; }

.h-notice { padding: 11px 14px; border: 1px solid var(--color-border); border-radius: 9px; color: var(--color-secondary); background: var(--color-surface); }
.h-notice[data-tone=error] { color: var(--color-unavailable); border-color: color-mix(in srgb, var(--color-unavailable) 45%, var(--color-border)); }
.h-empty { padding: 32px 20px; border: 1px solid var(--color-border); border-radius: 9px; color: var(--color-muted); text-align: center; }
.h-banner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 12px 16px; border: 1px solid color-mix(in srgb, var(--color-unavailable) 45%, var(--color-border)); border-radius: 9px; background: color-mix(in srgb, var(--color-unavailable) 7%, var(--color-surface)); color: var(--color-primary); }
.h-banner a { color: var(--color-primary); text-decoration: underline; text-underline-offset: 3px; }

.h-skeleton { height: 14px; border-radius: 4px; background: linear-gradient(90deg, var(--color-border), var(--color-surface-raised), var(--color-border)); background-size: 200% 100%; animation: h-shimmer 1.4s linear infinite; }
@keyframes h-shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .h-skeleton { animation: none; } }

@media (max-width: 760px) {
  .h-search { width: 100%; }
  .h-controls { width: 100%; }
  .h-table th, .h-table td { padding: 10px 12px; }
  .h-strip-cell { display: none; }
}
`;
