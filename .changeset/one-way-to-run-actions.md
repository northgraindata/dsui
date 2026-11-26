---
"@northgraindata/dsui-adapter-sdk": minor
---

Buttons, table and list row actions and forms run actions the same way:

- A declared confirmation uses DSUI's dialog instead of `window.confirm`. Its title and description may name the object with `{field}` placeholders, and `confirmLabel` is now honoured on buttons.
- A pending action cannot be run twice.
- A failure is shown in a toast, and the control is marked, without text that changes its size. A submitted form reports success in a toast.
- A list's overflow menu uses the shared menu, and icon-only row buttons have tooltips.
