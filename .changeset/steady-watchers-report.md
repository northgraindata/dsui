---
"@northgraindata/dsui-adapter-sdk": patch
---

`Collection` watches a polled source, so it refreshes on its interval and after an action. `watchResource` takes an optional `onError`, which `Collection` and `Resource` use to explain a first read that fails. A failed refresh keeps the data already shown.
