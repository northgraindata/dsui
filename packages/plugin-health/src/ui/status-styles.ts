/**
 * Styles for status pages, layered on the shared `.h-page` styles.
 *
 * Colors come from the host theme so light and dark both work. A partial
 * outage sits between degraded and down, so it mixes the two.
 */
export const statusStyles = `
.sp-page {
  --sp-operational: var(--color-healthy);
  --sp-degraded: var(--color-warning);
  --sp-partial: color-mix(in srgb, var(--color-warning) 45%, var(--color-unavailable));
  --sp-major: var(--color-unavailable);
  --sp-maintenance: var(--color-accent);
  --sp-unknown: var(--color-muted);
  --sp-missing: var(--color-border-strong, var(--color-border));
  max-width: 920px;
}
.sp-page [data-status=operational] { --sp-tone: var(--sp-operational); }
.sp-page [data-status=degraded] { --sp-tone: var(--sp-degraded); }
.sp-page [data-status=partial-outage] { --sp-tone: var(--sp-partial); }
.sp-page [data-status=major-outage] { --sp-tone: var(--sp-major); }
.sp-page [data-status=maintenance] { --sp-tone: var(--sp-maintenance); }
.sp-page [data-status=unknown] { --sp-tone: var(--sp-unknown); }
.sp-page [data-status=missing] { --sp-tone: var(--sp-missing); }

.sp-toolbar { display: flex; justify-content: flex-end; margin-bottom: -12px; }
.sp-head { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
.sp-head h1 { margin: 0; color: var(--color-primary); font-size: 22px; font-weight: 650; letter-spacing: -0.03em; }
.sp-head p { margin-top: 6px; max-width: 560px; color: var(--color-muted); font-size: 12px; line-height: 1.5; }

.sp-dot { position: relative; display: inline-block; width: 8px; height: 8px; flex: none; border-radius: 50%; background: var(--sp-tone, var(--sp-unknown)); }
.sp-status { display: inline-flex; align-items: center; gap: 8px; color: var(--sp-tone, var(--color-secondary)); font-weight: 550; white-space: nowrap; }
.sp-status[data-status=operational] { color: var(--color-secondary); }
.sp-status[data-status=operational] .sp-dot { background: var(--sp-operational); }

.sp-banner { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 12px; padding: 16px 20px; border: 1px solid color-mix(in srgb, var(--sp-tone) 40%, var(--color-border)); border-radius: 10px; background: color-mix(in srgb, var(--sp-tone) 9%, var(--color-surface)); }
.sp-banner strong { color: var(--color-primary); font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.sp-banner > span:last-child { margin-left: auto; color: var(--color-muted); font-size: 11px; }
.sp-banner .sp-dot { width: 10px; height: 10px; box-shadow: 0 0 0 4px color-mix(in srgb, var(--sp-tone) 22%, transparent); }
.sp-banner:not([data-status=operational]):not([data-status=unknown]) .sp-dot { animation: sp-pulse 2s ease-out infinite; }
@keyframes sp-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--sp-tone) 55%, transparent); } 100% { box-shadow: 0 0 0 9px transparent; } }

.sp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
.sp-card { position: relative; display: grid; grid-template-columns: 4px 1fr; overflow: hidden; height: 100%; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); transition: border-color 140ms, transform 140ms; }
a.sp-card:hover { border-color: var(--color-border-strong); transform: translateY(-1px); }
.sp-card-band { background: var(--sp-tone); }
.sp-card-body { display: grid; gap: 6px; padding: 14px 16px; min-width: 0; }
.sp-card-body strong { color: var(--color-primary); font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
.sp-card-description { overflow: hidden; color: var(--color-muted); text-overflow: ellipsis; white-space: nowrap; }
.sp-card-foot { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 12px; margin-top: 6px; font-size: 11px; }
.sp-card-loading { display: grid; grid-template-columns: 1fr; gap: 10px; padding: 18px 16px; }

.sp-components { display: grid; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); }
.sp-component { display: grid; gap: 10px; padding: 16px 20px; border-bottom: 1px solid var(--color-border); }
.sp-component:last-child { border-bottom: 0; }
.sp-component > header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.sp-component h3 { margin: 0; color: var(--color-primary); font-size: 13px; font-weight: 600; }
.sp-component header p { margin-top: 3px; color: var(--color-muted); font-size: 11px; }
.sp-component > footer { display: flex; align-items: center; gap: 10px; color: var(--color-muted); font-size: 10px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sp-rule { flex: 1; height: 1px; background: var(--color-border); }
.sp-bars { display: block; width: 100%; height: 30px; }
.sp-bars rect { fill: var(--sp-tone, var(--sp-missing)); transition: opacity 120ms; }
.sp-bars rect[data-status=missing] { opacity: 0.5; }
.sp-bars:hover rect { opacity: 0.55; }
.sp-bars rect:hover { opacity: 1; }

.sp-notices { display: grid; gap: 12px; }
.sp-notice { display: grid; gap: 14px; padding: 16px 20px; border: 1px solid var(--color-border); border-left: 3px solid var(--sp-impact, var(--color-border-strong)); border-radius: 10px; background: var(--color-surface); }
.sp-notice[data-impact=degraded] { --sp-impact: var(--sp-degraded); }
.sp-notice[data-impact=partial-outage] { --sp-impact: var(--sp-partial); }
.sp-notice[data-impact=major-outage] { --sp-impact: var(--sp-major); }
.sp-notice[data-impact=maintenance] { --sp-impact: var(--sp-maintenance); }
.sp-notice[data-impact=operational] { --sp-impact: var(--sp-operational); }
.sp-notice[data-resolved=true] { --sp-impact: var(--color-border-strong); }
.sp-notice > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.sp-notice h3 { margin: 0; color: var(--color-primary); font-size: 14px; font-weight: 600; letter-spacing: -0.01em; }
.sp-notice header p { margin-top: 4px; font-size: 11px; }

.sp-updates { display: grid; margin: 0; padding: 0; list-style: none; }
.sp-updates li { position: relative; display: grid; grid-template-columns: 110px 1fr; gap: 2px 16px; padding: 0 0 14px 18px; }
.sp-updates li::before { position: absolute; top: 5px; left: 0; width: 7px; height: 7px; border-radius: 50%; background: var(--color-muted); content: ""; }
.sp-updates li::after { position: absolute; top: 16px; bottom: 2px; left: 3px; width: 1px; background: var(--color-border); content: ""; }
.sp-updates li:last-child { padding-bottom: 0; }
.sp-updates li:last-child::after { display: none; }
.sp-updates li[data-status=resolved]::before { background: var(--sp-operational); }
.sp-updates li[data-status=investigating]::before { background: var(--sp-major); }
.sp-updates li[data-status=identified]::before { background: var(--sp-degraded); }
.sp-updates li[data-status=monitoring]::before { background: var(--sp-maintenance); }
.sp-updates strong { color: var(--color-primary); font-weight: 550; }
.sp-updates p { grid-column: 2; grid-row: 1 / span 2; color: var(--color-secondary); line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.sp-updates time { color: var(--color-muted); font-size: 10px; font-variant-numeric: tabular-nums; }

.sp-form, .sp-editor { display: grid; gap: 14px; }
.sp-form h2, .sp-editor h2 { margin: 0; }
.sp-form-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }
.sp-form-row .h-grow { flex: 1 1 240px; }
.sp-form .h-field input, .sp-form .h-field select, .sp-editor .h-field input { width: 100%; box-sizing: border-box; }
.sp-form textarea { width: 100%; box-sizing: border-box; }
.sp-choices { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; margin: 0; padding: 0; border: 0; }
.sp-choices legend { margin-bottom: 8px; padding: 0; color: var(--color-muted); font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
.sp-choices label { display: inline-flex; align-items: center; gap: 7px; min-height: 30px; padding: 0 11px; border: 1px solid var(--color-border); border-radius: 999px; color: var(--color-secondary); background: var(--color-surface); cursor: pointer; transition: border-color 140ms, background-color 140ms; }
.sp-choices label:hover { border-color: var(--color-border-strong); }
.sp-choices label:has(input:checked) { color: var(--color-primary); border-color: color-mix(in srgb, var(--color-accent) 60%, var(--color-border)); background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); }
.sp-choices label .h-muted { font-size: 10px; }
.sp-choices input { width: 13px; height: 13px; margin: 0; accent-color: var(--color-accent); }

.sp-editor-components { display: grid; gap: 12px; min-width: 0; margin: 0; padding: 0; border: 0; }
.sp-editor-components legend { padding: 0; color: var(--color-primary); font-size: 13px; font-weight: 600; }
.sp-editor-components > p { margin-top: 2px; font-size: 11px; }
.sp-editor-component { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--color-border); border-radius: 9px; background: var(--color-surface-raised, var(--color-surface)); }
.sp-editor-tools { display: flex; gap: 6px; }
.sp-editor-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.sp-spacer { flex: 1; }
.sp-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 640px) {
  .sp-banner > span:last-child { margin-left: 0; width: 100%; }
  .sp-updates li { grid-template-columns: 1fr; }
  .sp-updates p { grid-column: 1; grid-row: auto; }
  .sp-component { padding: 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .sp-banner .sp-dot { animation: none !important; }
  a.sp-card:hover { transform: none; }
}
`;
