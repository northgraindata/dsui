export const styles = `
.dx-screen{color:var(--color-primary);font-size:12px;line-height:1.5}
.dx-screen h2,.dx-screen h3,.dx-screen p{margin:0}
.dx-screen h2{font-size:18px;font-weight:600;letter-spacing:-.02em}
.dx-screen h3{font-size:13px;font-weight:600}
.dx-screen p,.dx-screen small{color:var(--color-muted);overflow-wrap:anywhere}
.dx-screen button:not([class^="dsui-option-select"]),.dx-screen input{font:inherit;color:var(--color-secondary);background:var(--color-surface);border:1px solid var(--color-border-strong);border-radius:6px;padding:7px 11px}
.dx-screen button{cursor:pointer}
.dx-screen button:not([class^="dsui-option-select"]):hover{background:var(--color-surface-hover)}
.dx-screen button:disabled{opacity:.55;cursor:not-allowed}
.dx-screen button:focus-visible,.dx-screen select:focus-visible,.dx-screen input:focus-visible,.dx-screen summary:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}
.dx-screen .dx-primary{background:var(--color-accent);border-color:var(--color-accent);color:var(--color-accent-foreground);font-weight:600;padding:9px 18px}
.dx-screen .dx-primary:hover{background:var(--color-accent-hover)}
.dx-screen .dx-back{border:0;background:transparent;padding:0;margin-bottom:14px;color:var(--color-muted)}
.dx-screen [data-status=none],.dx-screen [data-status=partial]{--dx-tone:var(--color-unknown)}
.dx-screen [data-status=queued],.dx-screen [data-status=running],.dx-screen [data-status=incomplete]{--dx-tone:var(--color-warning)}
.dx-screen [data-status=valid]{--dx-tone:var(--color-healthy)}
.dx-screen [data-status=issues]{--dx-tone:var(--color-unavailable)}
.dx-badge{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;color:var(--dx-tone);border:1px solid color-mix(in srgb,var(--dx-tone) 35%,transparent);background:color-mix(in srgb,var(--dx-tone) 10%,transparent)}
.dx-badge i{width:6px;height:6px;border-radius:50%;background:currentColor}
.dx-hero,.dx-card{border:1px solid var(--color-border);border-left:3px solid var(--dx-tone);border-radius:8px;background:var(--color-surface)}
.dx-hero{display:flex;flex-wrap:wrap;justify-content:space-between;gap:20px;padding:20px}
.dx-hero>div:first-child{display:flex;flex-direction:column;align-items:flex-start;gap:10px;min-width:0;flex:1 1 240px}
.dx-title,.dx-run-meta,.dx-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dx-run-layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(260px,1fr);gap:16px;align-items:start}
.dx-run-main{display:grid;gap:16px;min-width:0}
.dx-panel{min-width:0;border:1px solid var(--color-border);border-radius:8px;padding:16px;background:var(--color-surface)}
.dx-panel>.dx-heading:first-child{margin-top:0;margin-bottom:12px}
.dx-run-meta>p{flex-basis:100%}
.dx-run-meta>span:not(.dx-badge){color:var(--color-muted)}
.dx-actions button[aria-pressed=true]{border-color:var(--color-accent);color:var(--color-accent)}
.dx-screen .dx-text-button{padding:0;background:transparent;border:0;text-align:left;color:var(--color-accent)}
.dx-screen .dx-text-button:hover{text-decoration:underline}
.dx-table td small{display:block;white-space:nowrap}
.dx-schedule-form{display:grid;gap:12px;padding:12px;margin:8px 0 14px;border:1px solid var(--color-border);border-radius:6px}
.dx-schedule-form>label,.dx-json label,.dx-field{display:grid;gap:4px;color:var(--color-muted)}
.dx-command-picker{display:grid;gap:8px;min-width:0;margin:0;padding:8px;border:1px solid var(--color-border);border-radius:6px}
.dx-command-picker label{display:flex;gap:8px;align-items:flex-start}
.dx-command-picker small{display:block;font-family:var(--font-mono,monospace);overflow-wrap:anywhere}
.dx-schedule-list{list-style:none;margin:0;padding:0}
.dx-schedule-list li{display:grid;gap:8px;padding:12px 0}
.dx-schedule-list li+li{border-top:1px solid var(--color-border)}
.dx-json{display:grid;gap:12px}
.dx-json .dsui-option-select{max-width:100%;width:min(100%,360px)}
.dx-json-actions{min-height:30px}
@media (max-width:1040px){.dx-run-layout{grid-template-columns:minmax(0,1fr)}}
.dx-project-section{margin-top:20px}
.dx-project-section>h3{margin-bottom:12px}
.dx-results .dx-table td small{max-width:72ch;white-space:normal;overflow-wrap:anywhere}
.dx-projects{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))}
.dx-card{position:relative;display:flex;flex-direction:column;gap:8px;padding:16px}
.dx-card:hover,.dx-card:focus-within{border-color:var(--color-border-strong);border-left-color:var(--dx-tone)}
.dx-card-link::after{content:"";position:absolute;inset:0;border-radius:8px}
.dx-card-link:focus-visible::after{outline:2px solid var(--color-accent);outline-offset:2px}
.dx-card-actions{position:relative;z-index:1;align-self:flex-start;display:flex;gap:8px;align-items:flex-start;margin-top:8px}
.dx-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:6px 0}
.dx-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:18px 0;border-bottom:1px solid var(--color-border)}
.dx-screen .dx-tabs button{border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;color:var(--color-muted)}
.dx-screen .dx-tabs button[aria-pressed=true]{color:var(--color-primary);border-bottom-color:var(--color-accent)}
.dx-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:10px;list-style:none;margin:0 0 20px;padding:0}
.dx-steps li{display:flex;gap:10px;padding:12px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface)}
.dx-steps small{display:block;font-size:11px}
.dx-steps [data-state=ok] b{color:var(--color-healthy)}
.dx-steps [data-state=failed] b{color:var(--color-unavailable)}
.dx-steps [data-state=running] b,.dx-steps [data-state=needs-confirmation] b{color:var(--color-warning)}
.dx-findings{list-style:none;margin:0;padding:0;border:1px solid var(--color-border);border-radius:8px;overflow:hidden}
.dx-finding{display:flex;gap:12px;padding:12px 14px;background:var(--color-surface)}
.dx-finding+.dx-finding{border-top:1px solid var(--color-border)}
.dx-finding>div{min-width:0}
.dx-finding strong{font-weight:600;overflow-wrap:anywhere}
.dx-finding small{font-size:10px}
.dx-severity{align-self:flex-start;flex-shrink:0;width:58px;text-align:center;border-radius:4px;padding:2px 0;font-size:10px;font-weight:600;text-transform:uppercase;color:var(--color-warning);background:color-mix(in srgb,currentColor 12%,transparent)}
.dx-finding[data-severity=high] .dx-severity{color:var(--color-unavailable)}
.dx-finding[data-severity=low] .dx-severity{color:var(--color-unknown)}
.dx-details{margin-top:14px;color:var(--color-muted)}
.dx-details summary{cursor:pointer}
.dx-table{overflow-x:auto;border:1px solid var(--color-border);border-radius:8px;margin-top:10px}
.dx-table table{width:100%;border-collapse:collapse}
.dx-table th,.dx-table td{text-align:left;padding:9px 12px;vertical-align:top}
.dx-table th{font-size:11px;font-weight:500;color:var(--color-muted);background:var(--color-surface-raised)}
.dx-table tbody tr{border-top:1px solid var(--color-border);background:var(--color-surface)}
.dx-table tr[aria-current=true]{background:var(--color-surface-hover)}
.dx-freshness{margin-bottom:10px!important}
.dx-code{overflow:auto;max-height:520px;margin:0;padding:14px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-canvas);font:11px/1.6 var(--font-mono,monospace)}
.dx-empty{text-align:center;padding:32px 16px!important;border:1px dashed var(--color-border);border-radius:8px;margin-top:10px!important}
.dx-notice{margin-bottom:12px!important}
.dx-screen .dx-error{color:var(--color-unavailable);margin-top:8px}

`;
