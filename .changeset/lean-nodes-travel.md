---
"@northgraindata/dsui-adapter-sdk": patch
---

Page serialization is generic: every declared prop now reaches the browser. This restores props the previous hand-written serializer dropped, such as `PageHeader.icon` on native header nodes. Functions and class instances other than the documented bindings are rejected with `UnserializablePageError`.
