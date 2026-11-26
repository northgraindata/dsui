---
"@northgraindata/dsui-adapter-sdk": patch
---

The Airflow adapter takes state names and tones from one table of every task state. `restarting` and `awaiting_input` were shown muted in lists, and the task graph also drew `up_for_retry` and `up_for_reschedule` like tasks that never ran.
