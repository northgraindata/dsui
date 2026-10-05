export const styles = `
.cr-screen{color:var(--color-primary);font-size:12px;line-height:1.5}
.cr-screen h2,.cr-screen h3,.cr-screen p{margin:0}
.cr-screen h2{font-size:14px;font-weight:600;letter-spacing:-.02em}
.cr-screen h3{font-size:13px;font-weight:600}
.cr-screen p{color:var(--color-muted);overflow-wrap:anywhere}
.cr-screen button{font:inherit;cursor:pointer;color:var(--color-secondary);background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;padding:7px 11px;transition:background-color 140ms,border-color 140ms;text-align:left}
.cr-screen button:hover{background:var(--color-surface-hover);border-color:var(--color-border-strong)}
.cr-screen button:active{background:var(--color-surface-raised)}
.cr-screen button:disabled{opacity:.5;cursor:not-allowed}
.cr-screen button:focus-visible,.cr-screen input:focus-visible,.cr-screen textarea:focus-visible,.cr-screen select:focus-visible{outline:2px solid var(--color-accent);outline-offset:3px}
.cr-screen .cr-primary{background:var(--color-accent);border-color:var(--color-accent);color:var(--color-accent-foreground);font-weight:500}
.cr-screen .cr-primary:hover{background:var(--color-accent-hover)}
.cr-screen .cr-danger{color:var(--color-unavailable)}
.cr-screen .cr-back{border:0;background:transparent;padding:0;color:var(--color-muted);margin-bottom:20px;font-size:11px}
.cr-section-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:26px 0 14px}
.cr-section-heading p{font-size:11px;margin-top:4px}
.cr-settings-heading{margin-top:0;margin-bottom:24px}
.cr-service-identity{display:flex;align-items:center;gap:12px}
.cr-service-identity img,.cr-service-title img{object-fit:contain;flex-shrink:0}
.cr-services{display:grid;gap:16px}
.cr-service-card,.cr-card{border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface);overflow:hidden}
.cr-service-card{position:relative;padding:18px}
.cr-screen .cr-service-title{display:flex;align-items:center;gap:12px;width:100%;border:0;background:transparent;padding:0}
.cr-service-title::before{content:"";position:absolute;inset:0;border-radius:8px}
.cr-service-title span:first-of-type{flex:1;color:var(--color-primary);font-size:13px;font-weight:500}
.cr-service-title small{display:block;color:var(--color-muted);font-size:11px;font-weight:400;margin-top:2px}
.cr-link{font-size:11px;color:var(--color-muted)}
.cr-connections{position:relative;z-index:1;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,max(210px,calc(33.333% - 8px))),1fr));gap:10px;margin-top:18px}
.cr-screen .cr-connection{display:flex;flex-direction:column;align-items:stretch;gap:8px;padding:14px;background:var(--color-background);min-width:0}
.cr-connection-heading{display:flex;align-items:center;gap:9px;color:var(--color-primary)}
.cr-connection-heading strong{font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cr-arrow{margin-left:auto;color:var(--color-muted)}
.cr-source-icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--color-muted)}
.cr-repository{font-size:11px;font-family:ui-monospace,monospace;color:var(--color-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.cr-branch{font-size:11px;color:var(--color-muted);overflow-wrap:anywhere}
.cr-connection-footer{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:10px;padding-top:12px;border-top:1px solid var(--color-border);font-size:10px;color:var(--color-muted);flex-wrap:wrap}
.cr-status{display:inline-flex;gap:6px;align-items:center;white-space:nowrap;color:var(--color-muted);font-size:10px}
.cr-status i{width:5px;height:5px;border-radius:50%;background:currentColor}
.cr-status[data-status=ready]{color:var(--color-healthy)}
.cr-status[data-status=error]{color:var(--color-unavailable)}
.cr-status[data-status=syncing],.cr-status[data-status=queued]{color:var(--color-warning)}
.cr-screen .cr-connect-empty{border-style:dashed;align-items:center;justify-content:center;text-align:center;min-height:130px;color:var(--color-muted)}
.cr-connect-empty>span:first-child{font-size:22px;color:var(--color-accent)}
.cr-connect-empty>span:last-child{font-size:11px}
.cr-card{margin-bottom:16px}
.cr-card-heading{display:flex;align-items:center;gap:12px;padding:18px 20px}
.cr-card-heading>div{flex:1;min-width:0}
.cr-card-heading p{margin-top:4px}
.cr-details{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin:0;padding:0 20px 20px}
.cr-details dt{font-size:10px;color:var(--color-muted);margin-bottom:5px}
.cr-details dd{font-size:11px;color:var(--color-secondary);margin:0;overflow-wrap:anywhere}
.cr-card-actions{display:flex;gap:8px;align-items:center;border-top:1px solid var(--color-border);padding:12px 20px;flex-wrap:wrap;background:var(--color-background)}
.cr-remove{margin-left:auto}
.cr-instructions{margin:0 20px 18px;font-size:11px;color:var(--color-muted)}
.cr-instructions summary{cursor:pointer}.cr-instructions p{white-space:pre-wrap;margin-top:8px}
.cr-error{color:var(--color-unavailable)!important;background:color-mix(in srgb,var(--color-unavailable) 6%,transparent);border:1px solid color-mix(in srgb,var(--color-unavailable) 25%,transparent);border-radius:6px;padding:10px 12px;margin:12px 0!important;font-size:11px}
.cr-card>.cr-error{margin:0 20px 16px!important}
.cr-confirm{padding:14px 20px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid var(--color-border)}
.cr-confirm p{flex:1}
.cr-empty{text-align:center;padding:44px 20px;border:1px dashed var(--color-border);border-radius:8px;background:var(--color-surface)}
.cr-empty h3{margin:12px 0 5px}.cr-empty p{font-size:11px;max-width:360px;margin:auto}
.cr-form{border:1px solid var(--color-border);border-radius:8px;background:var(--color-surface);max-width:820px;overflow:hidden}
.cr-form-heading{padding:20px 24px;border-bottom:1px solid var(--color-border)}
.cr-form-heading h3{font-size:14px}.cr-form-heading p{font-size:11px;margin-top:5px}
.cr-form fieldset{border:0;margin:0;padding:22px 24px;border-bottom:1px solid var(--color-border);min-width:0}
.cr-form legend{float:left;width:100%;font-size:12px;font-weight:500;margin-bottom:16px;color:var(--color-primary)}
.cr-form legend span{color:var(--color-muted);font:10px ui-monospace,monospace;margin-right:10px}
.cr-fields{clear:both;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.cr-form label{display:block;font-size:11px;font-weight:500;color:var(--color-secondary);min-width:0}
.cr-form input,.cr-form select,.cr-form textarea{box-sizing:border-box;display:block;width:100%;margin-top:7px;background:var(--color-background);color:var(--color-primary);border:1px solid var(--color-border-strong);border-radius:5px;padding:9px 10px;font:inherit;font-size:12px;min-height:36px}
.cr-form input::placeholder,.cr-form textarea::placeholder{color:var(--color-muted);opacity:.65}
.cr-form textarea{resize:vertical;line-height:1.6}
.cr-form label+label{margin-top:16px}.cr-fields label+label{margin-top:0}
.cr-form .cr-row{display:flex;gap:8px;align-items:center;margin-top:7px}
.cr-form .cr-row input{margin-top:0;min-width:0;flex:1}.cr-form .cr-row button{white-space:nowrap;font-size:11px}
.cr-form label>button{margin-top:8px;font-size:11px}
.cr-provider-options{clear:both;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:20px}
.cr-screen .cr-provider-options button{display:grid;grid-template-columns:22px 1fr;column-gap:8px;row-gap:4px;padding:12px;background:var(--color-background)}
.cr-provider-options button .cr-source-icon{grid-row:span 2}.cr-provider-options strong{font-size:12px;font-weight:500}.cr-provider-options small{font-size:10px;color:var(--color-muted)}
.cr-screen .cr-provider-options button[aria-pressed=true]{border-color:var(--color-accent);background:color-mix(in srgb,var(--color-accent) 8%,var(--color-background));color:var(--color-primary)}
.cr-optional{font-size:10px;color:var(--color-muted);font-weight:400;margin-left:5px}
.cr-field-help{font-size:11px;margin-bottom:14px!important;clear:both}.cr-form label+.cr-field-help{margin-top:8px;margin-bottom:0!important}
.cr-form-actions{padding:16px 24px;display:flex;gap:8px;background:var(--color-background)}
.cr-check-result{margin:16px 24px;padding:12px;border:1px solid color-mix(in srgb,var(--color-healthy) 30%,transparent);border-radius:6px;background:color-mix(in srgb,var(--color-healthy) 5%,transparent);font-size:11px}.cr-check-result strong{color:var(--color-healthy);font-weight:500}.cr-check-result p{margin-top:4px}
.cr-form>.cr-error{margin:12px 24px!important}
@media(max-width:640px){.cr-details{grid-template-columns:repeat(2,minmax(0,1fr))}.cr-fields{grid-template-columns:1fr}.cr-provider-options{grid-template-columns:1fr}.cr-settings-heading{align-items:flex-start}.cr-card-heading{flex-wrap:wrap}.cr-card-heading>.cr-status{margin-left:30px}.cr-form fieldset,.cr-form-heading{padding:18px}.cr-connection-footer{align-items:flex-start}}
@media(prefers-reduced-motion:reduce){.cr-screen button{transition:none}}
`;
