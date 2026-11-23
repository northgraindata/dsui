/**
 * Styles for status pages, layered on the shared `.h-page` styles.
 *
 * The host already renders the page title in its own header, so these
 * screens start at section level: nothing here is larger than the host's
 * 17px heading. Colors come from the host theme so light and dark both work;
 * a partial outage sits between degraded and down, so it mixes the two.
 */
export const statusStyles = `
.sp-page {
  --sp-operational: var(--color-healthy);
  --sp-degraded: var(--color-warning);
  --sp-partial: color-mix(in srgb, var(--color-warning) 45%, var(--color-unavailable));
  --sp-major: var(--color-unavailable);
  --sp-maintenance: var(--color-accent);
  --sp-unknown: var(--color-muted);
  --sp-missing: var(--color-border);
  --sp-radius: 10px;
  max-width: none;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}
.sp-page > *, .sp-block > * { min-width: 0; }
.sp-page [data-status=operational] { --sp-tone: var(--sp-operational); }
.sp-page [data-status=degraded] { --sp-tone: var(--sp-degraded); }
.sp-page [data-status=partial-outage] { --sp-tone: var(--sp-partial); }
.sp-page [data-status=major-outage] { --sp-tone: var(--sp-major); }
.sp-page [data-status=maintenance] { --sp-tone: var(--sp-maintenance); }
.sp-page [data-status=unknown] { --sp-tone: var(--sp-unknown); }
.sp-page [data-status=resolved] { --sp-tone: var(--color-border-strong, var(--color-border)); }
.sp-page [data-status=missing] { --sp-tone: var(--sp-missing); }

/* Status text: a dot and a label, colored only when something is wrong. */
.sp-dot { display: inline-block; width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--sp-tone, var(--sp-unknown)); }
.sp-status { display: inline-flex; align-items: center; gap: 7px; color: var(--sp-tone, var(--color-secondary)); font-size: 12px; font-weight: 500; white-space: nowrap; }
.sp-status[data-status=operational], .sp-status[data-status=unknown] { color: var(--color-secondary); }

/* Section blocks with a small label instead of competing headings. */
.sp-block { display: grid; gap: 10px; }
.sp-label { margin: 0; color: var(--color-muted); font-size: 10px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; }
.sp-quiet { margin: 0; color: var(--color-muted); font-size: 12px; }

.sp-back { justify-self: start; display: inline-flex; align-items: center; gap: 6px; margin-bottom: -10px; color: var(--color-muted); font-size: 11px; transition: color 140ms; }
.sp-back:hover { color: var(--color-primary); }

/* List of pages. */
.sp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
.sp-cards > li { display: grid; }
.sp-card { display: grid; align-content: start; gap: 4px; min-height: 112px; box-sizing: border-box; padding: 16px; border: 1px solid var(--color-border); border-radius: var(--sp-radius); color: inherit; background: var(--color-surface); text-align: left; font: inherit; transition: border-color 140ms, background-color 140ms; }
a.sp-card:hover { border-color: var(--color-border-strong); background: var(--color-surface-hover, var(--color-surface)); }
.sp-card strong { color: var(--color-primary); font-size: 13px; font-weight: 600; }
.sp-card-description { overflow: hidden; color: var(--color-muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.sp-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 14px; color: var(--color-muted); font-size: 11px; white-space: nowrap; }
.sp-card-new { align-content: center; justify-items: start; border-style: dashed; color: var(--color-muted); cursor: pointer; }
.sp-card-new > span:first-child { display: grid; place-items: center; width: 24px; height: 24px; margin-bottom: 6px; border: 1px solid var(--color-border); border-radius: 7px; font-size: 15px; line-height: 1; }
.sp-card-new:hover { border-color: var(--color-border-strong); color: var(--color-secondary); }
.sp-card .h-skeleton:first-child { width: 55%; }

/* Page header: name, overall status and actions in one place. */
.sp-hero { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px 24px; padding: 18px 20px; border: 1px solid color-mix(in srgb, var(--sp-tone) 32%, var(--color-border)); border-radius: var(--sp-radius); background: linear-gradient(90deg, color-mix(in srgb, var(--sp-tone) 9%, var(--color-surface)), var(--color-surface) 70%); }
.sp-hero[data-status=operational], .sp-hero[data-status=unknown] { border-color: var(--color-border); background: var(--color-surface); }
.sp-hero-main { display: grid; gap: 6px; min-width: 0; }
.sp-hero-main h2 { color: var(--color-primary); font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.sp-hero-main p { max-width: 560px; color: var(--color-muted); font-size: 12px; line-height: 1.5; }
.sp-hero-main .sp-status { font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
.sp-hero:not([data-status=operational]):not([data-status=unknown]) .sp-dot { animation: sp-pulse 2s ease-out infinite; }
@keyframes sp-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--sp-tone) 55%, transparent); } 100% { box-shadow: 0 0 0 7px transparent; } }
.sp-hero-side { display: grid; justify-items: end; gap: 10px; }
.sp-hero-meta { color: var(--color-muted); font-size: 11px; }
.sp-actions { display: flex; gap: 8px; }

/* Components: one row each, uptime bars underneath. */
.sp-components { display: grid; border: 1px solid var(--color-border); border-radius: var(--sp-radius); background: var(--color-surface); }
.sp-component { display: grid; gap: 8px; padding: 14px 18px 12px; border-bottom: 1px solid var(--color-border); }
.sp-component:last-child { border-bottom: 0; }
.sp-component > header { display: flex; align-items: center; gap: 12px; }
.sp-component h4 { flex: 1; min-width: 0; margin: 0; overflow: hidden; color: var(--color-primary); font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.sp-uptime { color: var(--color-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.sp-component > footer { display: flex; justify-content: space-between; color: var(--color-muted); font-size: 10px; }
.sp-bars { display: block; width: 100%; height: 24px; }
.sp-bars rect { fill: var(--sp-tone, var(--sp-missing)); transition: opacity 120ms; }
.sp-bars:hover rect { opacity: 0.5; }
.sp-bars rect:hover { opacity: 1; }

/* Notices. */
.sp-notice { display: grid; gap: 14px; padding: 16px 18px; border: 1px solid var(--color-border); border-radius: var(--sp-radius); background: var(--color-surface); box-shadow: inset 3px 0 0 var(--sp-tone, var(--color-border)); }
.sp-notice > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.sp-notice-title { display: grid; gap: 3px; min-width: 0; }
.sp-notice h4 { margin: 0; color: var(--color-primary); font-size: 13px; font-weight: 600; }
.sp-notice-title p { color: var(--color-muted); font-size: 11px; }

.sp-updates { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.sp-updates li { display: grid; grid-template-columns: 96px 1fr; gap: 16px; }
.sp-updates time { padding-top: 1px; color: var(--color-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.sp-updates strong { color: var(--color-primary); font-size: 12px; font-weight: 600; }
.sp-updates p { margin-top: 2px; color: var(--color-secondary); font-size: 12px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }

/* Forms. */
.sp-form, .sp-editor { display: grid; gap: 14px; }
.h-card.sp-form, .sp-editor { padding: 18px 20px; border-radius: var(--sp-radius); }
.sp-form h2, .sp-editor h2 { margin: 0; font-size: 13px; }
.h-form.sp-form { padding: 14px; border-radius: 8px; background: var(--color-surface-raised, var(--color-surface)); }
.sp-form-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }
.sp-form-row .h-grow { flex: 1 1 240px; }
.sp-form .h-field, .sp-editor .h-field { min-width: 0; }
.sp-form .h-field input, .sp-form .h-field select, .sp-form textarea, .sp-editor .h-field input { width: 100%; box-sizing: border-box; }
.sp-form .h-section-actions, .sp-editor-actions { justify-content: flex-end; }
.sp-choices { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; margin: 0; padding: 0; border: 0; }
.sp-choices legend { margin-bottom: 8px; padding: 0; color: var(--color-muted); font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
.sp-choices label { display: inline-flex; align-items: center; gap: 7px; min-height: 28px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 999px; color: var(--color-secondary); background: var(--color-surface); font-size: 12px; cursor: pointer; transition: border-color 140ms, background-color 140ms; }
.sp-choices label:hover { border-color: var(--color-border-strong); }
.sp-choices label:has(input:checked) { color: var(--color-primary); border-color: color-mix(in srgb, var(--color-accent) 60%, var(--color-border)); background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); }
.sp-choices label .h-muted { font-size: 10px; }
.sp-choices input { width: 13px; height: 13px; margin: 0; accent-color: var(--color-accent); }

.sp-editor-components { display: grid; gap: 10px; min-width: 0; margin: 0; padding: 0; border: 0; }
.sp-editor-components legend { margin-bottom: 2px; padding: 0; color: var(--color-primary); font-size: 12px; font-weight: 600; }
.sp-editor-components > p { font-size: 11px; }
.sp-editor-component { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-raised, var(--color-surface)); }
.sp-editor-tools { display: flex; gap: 6px; }
.sp-editor-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-top: 14px; border-top: 1px solid var(--color-border); }
.sp-spacer { flex: 1; }
.sp-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

@media (max-width: 640px) {
  .sp-hero { padding: 16px; }
  .sp-hero-side { justify-items: start; }
  .sp-notice { padding: 14px 16px; }
  .sp-notice > header { flex-direction: column; gap: 10px; }
  .sp-component > header { flex-wrap: wrap; row-gap: 4px; }
  .sp-component h4 { flex-basis: 100%; }
  .sp-updates li { grid-template-columns: 1fr; gap: 2px; }
  .sp-component { padding: 12px 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .sp-hero .sp-dot { animation: none !important; }
}
`;
