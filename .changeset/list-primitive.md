---
"@northgraindata/dsui-adapter-sdk": minor
---

Add a `List` primitive for collections of named things such as jobs, runs, and assets. Each row shows an icon, a bold title with an optional tag, a description, a status with a detail line, primary actions as icon buttons, and the remaining actions in an overflow menu. Lists can be searched, filtered by declared or inferred values, and paged with "Show more". Status tones are inferred from common status words when a row does not provide one.

Table row-action menu entries now follow their `successLink` after the action succeeds, as row actions already did. The SDK icon set gains `plug` and `user`.
