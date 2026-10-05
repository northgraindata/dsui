export const styles = `
.sdk-code-explorer{border:1px solid var(--color-border);border-radius:8px;overflow:hidden;background:var(--color-surface);color:var(--color-secondary);font-size:12px;margin-top:8px}
.sdk-code-explorer .sdk-code-heading{display:flex;gap:16px;padding:14px 18px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--color-border);background:var(--color-background)}
.sdk-code-heading strong{font-size:12px;color:var(--color-primary);font-weight:500}.sdk-code-heading small{font-size:10px;color:var(--color-muted)}.sdk-code-heading code{margin-left:6px}
.sdk-code-explorer nav{display:flex;gap:4px;padding:10px 16px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--color-border)}
.sdk-code-explorer button{font:inherit;cursor:pointer;text-align:left;border:0;border-radius:4px;background:transparent;color:var(--color-secondary);padding:5px 8px;min-width:0;box-shadow:none}
.sdk-code-explorer button:hover{background:var(--color-surface-hover);border:0}.sdk-code-explorer button:focus-visible{outline:2px solid var(--color-accent);outline-offset:-2px}
.sdk-code-explorer button[aria-current]{background:color-mix(in srgb,var(--color-accent) 14%,transparent);color:var(--color-primary)}
.sdk-code-explorer nav button+button::before{content:"/";color:var(--color-muted);margin-right:12px}.sdk-code-explorer nav button:last-child{color:var(--color-primary);font-weight:500}
.sdk-code-explorer-layout{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:480px}
.sdk-code-explorer aside{padding:12px 8px;border-right:1px solid var(--color-border);overflow:auto;max-height:76vh;background:var(--color-background)}
.sdk-code-explorer aside input{box-sizing:border-box;display:block;width:calc(100% - 8px);margin:0 4px 12px;padding:8px 10px;font:inherit;color:var(--color-primary);background:var(--color-surface);border:1px solid var(--color-border-strong);border-radius:5px}
.sdk-code-explorer aside button{display:flex;gap:8px;align-items:center;width:100%;overflow:hidden;min-height:30px;font-size:11px;white-space:nowrap}.sdk-code-explorer aside button>span:last-child{overflow:hidden;text-overflow:ellipsis}
.sdk-code-tree{list-style:none;margin:0}.sdk-code-directory{display:flex;align-items:center}.sdk-code-explorer aside .sdk-code-toggle{width:22px;flex-shrink:0;padding:3px;color:var(--color-muted);justify-content:center}
.sdk-code-file-icon{color:var(--color-muted);margin-left:22px}.sdk-code-folder-icon{color:var(--color-accent-hover);font-size:16px;line-height:1}
.sdk-code-explorer main{min-width:0;padding:0;overflow:hidden}.sdk-code-file-heading{display:flex;gap:14px;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--color-border)}
.sdk-code-file-heading>div{display:flex;gap:12px;align-items:center;min-width:0;flex-wrap:wrap}.sdk-code-file-heading strong{font-size:11px;color:var(--color-primary);font-weight:500}.sdk-code-file-heading span{font-size:10px;color:var(--color-muted)}
.sdk-code-explorer .sdk-code-file-heading>button{border:1px solid var(--color-border-strong);font-size:10px;padding:4px 9px}
.sdk-code-preview-actions{display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-bottom:1px solid var(--color-border)}.sdk-code-preview-actions span{font-size:10px;color:var(--color-muted)}.sdk-code-preview-actions button{font-size:10px}.sdk-code-preview-actions button[aria-pressed=true]{color:var(--color-accent-hover)}
.sdk-code-explorer main>p,.sdk-code-explorer main>section{padding:20px}.sdk-code-explorer main>section>div{display:flex;border-bottom:1px solid var(--color-border);padding:6px 0}.sdk-code-explorer main>section button{width:100%;padding:7px 10px;font-size:12px}
.sdk-code-explorer .sdk-code-error{color:var(--color-unavailable);overflow-wrap:anywhere}.sdk-code-explorer pre{overflow:auto;padding:16px;font-size:12px;line-height:1.7}.sdk-code-explorer .sdk-code-empty{font-size:11px;color:var(--color-muted);padding:8px}
@media(max-width:700px){.sdk-code-explorer-layout{grid-template-columns:1fr}.sdk-code-explorer aside{max-height:220px;border-right:0;border-bottom:1px solid var(--color-border)}.sdk-code-heading small,.sdk-code-preview-actions span{display:none}}
`;
