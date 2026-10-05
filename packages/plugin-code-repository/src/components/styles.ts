export const styles = `
.cr-screen {
  font-size:13px;
  color:var(--color-foreground,inherit);
}
.cr-screen h2 {
  font-size:18px;
  font-weight:600;
}
.cr-screen h3 {
  font-size:15px;
  font-weight:600;
}
.cr-screen p {
  margin:10px 0;
  overflow-wrap:anywhere;
}
.cr-screen button {
  border:1px solid var(--color-border,#333);
  border-radius:7px;
  padding:7px 11px;
  cursor:pointer;
  background:transparent;
  text-align:left;
}
.cr-screen button:hover {
  background:var(--color-muted,#8882);
}
.cr-screen button:disabled {
  opacity:.45;
  cursor:wait;
}
.cr-screen button:focus-visible,.cr-screen input:focus-visible,.cr-screen textarea:focus-visible {
  outline:2px solid #7c9fff;
  outline-offset:2px;
}
.cr-row {
  display:flex;
  align-items:center;
  flex-wrap:wrap;
  gap:10px;
  margin:12px 0;
}
.cr-card {
  position:relative;
  border:1px solid var(--color-border,#333);
  border-radius:12px;
  padding:18px;
  margin:14px 0;
}
.cr-service-title {
  width:100%;
  display:flex;
  align-items:center;
  gap:12px;
  border:0!important;
  padding:0!important;
}
.cr-service-title::before {
  content:"";
  position:absolute;
  inset:0;
  border-radius:12px;
}
.cr-service-title span:first-of-type {
  flex:1;
}
.cr-service-title small {
  display:block;
  opacity:.6;
  margin-top:4px;
}
.cr-connections {
  position:relative;
  z-index:1;
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(min(100%,max(220px,calc(33.333% - 8px))),1fr));
  gap:12px;
  margin-top:18px;
}
.cr-connection {
  display:flex;
  flex-direction:column;
  gap:8px;
  min-width:0;
}
.cr-connection span {
  font-size:11px;
  opacity:.65;
  overflow-wrap:anywhere;
}
.cr-form {
  border:1px solid var(--color-border,#333);
  border-radius:12px;
  padding:20px;
  max-width:720px;
  margin:16px 0;
}
.cr-form label {
  display:block;
  margin:15px 0;
}
.cr-form input,.cr-form select,.cr-form textarea {
  display:block;
  width:100%;
  background:transparent;
  color:inherit;
  border:1px solid var(--color-border,#333);
  border-radius:6px;
  padding:9px;
  margin-top:6px;
}
.cr-form .cr-row input {
  flex:1;
  width:auto;
}
.cr-error {
  color:#ef7777;
}
.cr-status {
  font-size:11px;
  border:1px solid var(--color-border,#333);
  border-radius:20px;
  padding:3px 9px;
}
.cr-instructions {
  white-space:pre-wrap;
  opacity:.75;
}
.cr-explorer {
  display:grid;
  grid-template-columns:minmax(180px,24%) minmax(0,1fr);
  border:1px solid var(--color-border,#333);
  border-radius:10px;
  overflow:hidden;
  min-height:420px;
}
.cr-explorer aside {
  padding:10px;
  border-right:1px solid var(--color-border,#333);
  overflow:auto;
  max-height:75vh;
}
.cr-explorer aside button {
  display:block;
  width:100%;
  border:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.cr-explorer main {
  overflow:auto;
  padding:12px;
  max-height:75vh;
}
.cr-selected {
  background:#7c9fff22!important;
}
.cr-code pre {
  font-size:12px;
  line-height:1.7;
  font-family:ui-monospace,monospace;
  margin:0;
}
.cr-line {
  display:flex;
  min-width:max-content;
}
.cr-line:target {
  background:#7c9fff25;
}
.cr-line>a {
  color:inherit;
  opacity:.4;
  width:55px;
  flex-shrink:0;
  text-align:right;
  padding-right:16px;
  text-decoration:none;
  user-select:none;
}
.hljs-keyword,.hljs-selector-tag {
  color:#c792ea;
}
.hljs-string,.hljs-attr {
  color:#a8d998;
}
.hljs-number,.hljs-literal {
  color:#f7b267;
}
.hljs-comment {
  color:#8995a8;
}
.hljs-title,.hljs-function {
  color:#82aaff;
}
@media(max-width:640px) {
  .cr-explorer {
    grid-template-columns:1fr;
  }
  .cr-explorer aside {
    border-right:0;
    border-bottom:1px solid var(--color-border,#333);
    max-height:180px;
  }
  .cr-explorer main {
    max-height:60vh;
  }
}
`;
