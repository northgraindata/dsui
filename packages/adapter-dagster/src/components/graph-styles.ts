/**
 * Scoped styles for the lineage graph. The host only generates the utility
 * classes its own sources use, and this component ships as a runtime
 * bundle the host never scans, so it brings its own stylesheet built on the
 * shared theme tokens.
 */
export const GRAPH_STYLES = `
.dg { --dg-mono: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); color: var(--color-primary); border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); overflow: hidden; }
.dg button { font: inherit; }
.dg-stack { display: grid; gap: 8px; }
.dg-eyebrow { font-family: var(--dg-mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: .12em; color: var(--color-muted); }
.dg-count { font-family: var(--dg-mono); font-size: 9.5px; color: var(--color-muted); white-space: nowrap; }
.dg-dot { display: inline-block; width: 6px; height: 6px; flex-shrink: 0; border-radius: 999px; }

.dg-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 10px 16px; border-bottom: 1px solid var(--color-border); background: var(--color-surface-raised); }
.dg-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding-left: 14px; border-left: 1px solid var(--color-border); }
.dg-summary-item { display: inline-flex; align-items: center; gap: 6px; font-family: var(--dg-mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: .06em; line-height: 1; }
.dg-controls { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.dg-search { height: 26px; width: 168px; padding: 0 9px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-primary); font-size: 11.5px; outline: none; }
.dg-search::placeholder { color: var(--color-muted); }
.dg-search:focus { border-color: var(--color-accent); }
.dg-tool { display: grid; place-items: center; height: 26px; min-width: 26px; padding: 0 8px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-secondary); font-family: var(--dg-mono); font-size: 11px; line-height: 1; cursor: pointer; transition: border-color .15s, color .15s; }
.dg-tool:hover { border-color: var(--color-border-strong); color: var(--color-primary); }
.dg-zoom { min-width: 44px; text-align: center; font-family: var(--dg-mono); font-size: 10.5px; color: var(--color-secondary); }
.dg-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 8px 16px; border-bottom: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-surface-raised) 60%, transparent); }
.dg-legend-item { display: inline-flex; align-items: center; gap: 5px; }

.dg-tag { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; height: 20px; padding: 0 8px; border: 1px solid var(--color-border); border-radius: 999px; background: var(--color-surface); color: var(--color-secondary); font-size: 10.5px; font-weight: 500; line-height: 1; white-space: nowrap; }
button.dg-tag { cursor: pointer; transition: border-color .15s, color .15s; }
button.dg-tag:hover { color: var(--color-primary); border-color: var(--color-border-strong); }
.dg-tag[aria-pressed="true"] { border-color: var(--color-accent); color: var(--color-primary); }

.dg-canvas { position: relative; overflow: hidden; touch-action: none; cursor: grab; background-color: var(--color-canvas); background-image: radial-gradient(color-mix(in srgb, var(--color-border) 85%, transparent) 1px, transparent 1px); background-size: 20px 20px; }
.dg-canvas[data-panning="true"] { cursor: grabbing; user-select: none; }
/* No will-change or 3D transform: either keeps the board as one bitmap
   that gets stretched when zooming, which blurs text and borders. */
.dg-board { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
.dg-board[data-smooth="true"] { transition: transform .18s ease-out; }
.dg-hint { position: absolute; left: 14px; bottom: 11px; pointer-events: none; opacity: .75; }

.dg-frame { position: absolute; pointer-events: none; border: 1px solid var(--color-border); border-radius: 14px; background: color-mix(in srgb, var(--color-surface) 62%, transparent); transition: border-color .15s, background-color .15s; }
.dg-frame[data-emphasised="true"] { border-color: var(--color-border-strong); background: color-mix(in srgb, var(--color-surface) 85%, transparent); }
.dg-frame-header { display: flex; align-items: center; gap: 12px; height: 48px; padding: 0 16px 0 18px; }
.dg-frame-title { display: flex; align-items: center; gap: 8px; min-width: 0; flex-shrink: 0; max-width: 100%; }
.dg-frame-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; font-weight: 600; color: var(--color-primary); }
/* Wraps onto a clipped second line, so a tag is either whole or hidden. */
.dg-frame-kinds { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 5px; height: 20px; overflow: hidden; min-width: 0; flex: 1; }

.dg-node { position: absolute; display: flex; flex-direction: column; padding: 0; border: 1px solid var(--color-border-strong); border-radius: 10px; background: var(--color-surface); color: inherit; text-align: left; cursor: pointer; overflow: hidden; box-shadow: 0 1px 2px rgb(0 0 0 / .1), 0 6px 16px -10px rgb(0 0 0 / .45); transition: background-color .15s, border-color .15s, box-shadow .15s, opacity .15s; }
.dg-node:hover { background: var(--color-surface-hover); }
.dg-node:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.dg-node[data-external="true"] { border-style: dashed; background: var(--color-surface-raised); opacity: .72; }
.dg-node[data-external="true"]:hover { opacity: 1; }
.dg-node[data-emphasis="active"] { background: var(--color-surface-hover); border-color: var(--color-accent); opacity: 1; }
.dg-node[data-emphasis="lineage"], .dg-node[data-emphasis="match"] { opacity: 1; }
.dg-node[data-emphasis="dimmed"] { opacity: .3; }
.dg-node[data-selected="true"] { border-color: var(--color-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 30%, transparent); }
.dg-node[data-running="true"] { border-color: var(--color-accent); animation: dg-pulse 1.6s ease-in-out infinite; }
.dg-node-bar { position: absolute; left: 0; top: 12px; bottom: 42px; width: 3px; border-radius: 0 3px 3px 0; }
.dg-node-body { display: flex; align-items: center; gap: 12px; flex: 1; min-height: 0; padding: 10px 14px 8px 16px; }
.dg-glyph { display: grid; place-items: center; flex-shrink: 0; width: 34px; height: 34px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-hover); color: var(--color-secondary); font-family: var(--dg-mono); font-weight: 600; font-size: 12px; line-height: 1; }
.dg-glyph[data-long="true"] { font-size: 10px; }
.dg-glyph[data-icon="true"] { background: color-mix(in srgb, var(--color-surface-hover) 70%, var(--color-surface)); color: var(--color-primary); }
.dg-kind-icon { display: block; flex-shrink: 0; object-fit: contain; }
.dg-kind-icon--mono { background-color: currentColor; -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; }
.dg-node-text { display: grid; gap: 6px; min-width: 0; flex: 1; }
.dg-node-title { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dg-node-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; color: var(--color-primary); }
.dg-check { margin-left: auto; display: inline-grid; place-items: center; flex-shrink: 0; height: 17px; min-width: 17px; padding: 0 4px; border: 1px solid; border-radius: 5px; font-family: var(--dg-mono); font-size: 10px; line-height: 1; }
.dg-node-meta { display: flex; align-items: center; gap: 6px; min-width: 0; font-family: var(--dg-mono); font-size: 9.5px; text-transform: uppercase; letter-spacing: .06em; line-height: 1; }
.dg-node-caption { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-muted); text-transform: none; letter-spacing: 0; }
.dg-node-kinds { display: flex; align-items: center; gap: 5px; flex-shrink: 0; height: 32px; padding: 0 12px 0 16px; border-top: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-surface-raised) 70%, transparent); overflow: hidden; }
.dg-node-kinds .dg-tag { height: 19px; padding: 0 7px; font-size: 10px; }
@keyframes dg-pulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 40%, transparent); }
  50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-accent) 0%, transparent); }
}

.dg-edges { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.dg-edge { fill: none; stroke: var(--color-muted); stroke-opacity: .6; stroke-width: 1.3; transition: stroke-opacity .15s; }
.dg-edge[data-faded="true"] { stroke-opacity: .16; }
.dg-edge[data-lit="true"] { stroke: var(--color-accent); stroke-opacity: 1; stroke-width: 1.8; stroke-dasharray: 6 4; animation: dg-flow .9s linear infinite; }
@keyframes dg-flow { to { stroke-dashoffset: -20; } }

.dg-panel { position: absolute; top: 0; right: 0; bottom: 0; max-width: 100%; display: flex; flex-direction: column; cursor: auto; border-left: 1px solid var(--color-border); background: var(--color-surface); box-shadow: -12px 0 32px -20px rgb(0 0 0 / .55); }
.dg-panel-header { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--color-border); }
.dg-panel-heading { display: grid; gap: 6px; min-width: 0; }
.dg-panel-title { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
.dg-panel-sub { display: flex; align-items: center; gap: 6px; min-width: 0; font-family: var(--dg-mono); font-size: 10px; color: var(--color-muted); }
.dg-close { margin-left: auto; flex-shrink: 0; }
.dg-panel-body { display: grid; grid-auto-rows: min-content; gap: 18px; flex: 1; min-height: 0; overflow-y: auto; padding: 16px 18px; }
.dg-description { margin: 0; font-size: 12px; line-height: 1.55; color: var(--color-secondary); }
.dg-note { margin: 0; padding: 8px 10px; border: 1px dashed var(--color-border); border-radius: 6px; font-size: 11px; color: var(--color-muted); }
.dg-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.dg-details { display: grid; grid-template-columns: minmax(6rem, auto) 1fr; gap: 8px 16px; margin: 0; font-size: 11.5px; }
.dg-detail { display: contents; }
.dg-details dt { color: var(--color-secondary); }
.dg-details dd { margin: 0; color: var(--color-primary); overflow-wrap: anywhere; }
.dg-relations { display: grid; gap: 8px; }
.dg-relations ul { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.dg-relations li { max-width: 100%; }
.dg-chip { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 5px 9px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-secondary); font-size: 11px; cursor: pointer; transition: border-color .15s, color .15s; }
.dg-chip:hover { border-color: var(--color-accent); color: var(--color-primary); }
.dg-none { margin: 0; font-size: 11px; color: var(--color-muted); }
.dg-panel-footer { display: grid; gap: 8px; margin-top: auto; padding: 12px 18px; border-top: 1px solid var(--color-border); }
.dg-panel-actions { display: flex; align-items: center; gap: 8px; }
.dg-primary { padding: 7px 12px; border: 1px solid var(--color-accent); border-radius: 6px; background: var(--color-accent); color: var(--color-accent-foreground); font-size: 11.5px; font-weight: 600; cursor: pointer; }
.dg-primary:hover:not(:disabled) { background: var(--color-accent-hover, var(--color-accent)); }
.dg-primary:disabled { opacity: .6; cursor: default; }
.dg-secondary { margin-left: auto; padding: 7px 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-secondary); font-size: 11.5px; cursor: pointer; }
.dg-secondary:hover { border-color: var(--color-accent); color: var(--color-primary); }
.dg-link { padding: 0; border: 0; background: none; color: var(--color-secondary); font-size: 11px; cursor: pointer; }
.dg-link:hover { color: var(--color-primary); text-decoration: underline; }
.dg-message { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 11px; }
.dg-success { color: var(--color-healthy); }
.dg-status { padding: 18px 20px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); font-size: 12px; color: var(--color-secondary); }
.dg-error { color: var(--color-unavailable); }

@media (prefers-reduced-motion: reduce) {
  .dg-edge[data-lit="true"], .dg-node[data-running="true"] { animation: none; }
  .dg-board[data-smooth="true"] { transition: none; }
}
`;
