---
"@northgraindata/dsui-adapter-sdk": patch
---

`Value` and `KeyValue` no longer show "Loading…" forever when a resource returns a result without the requested data. `Value` shows its `fallback` or a dash, and `KeyValue` reports that no details are available. Long tab labels stay on one line and the tab list scrolls.
