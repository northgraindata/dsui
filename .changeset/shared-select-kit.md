---
"@northgraindata/dsui-adapter-sdk": minor
---

Browser bundles receive DSUI's shared controls as the third argument of `createComponents`, typed as `UiKit`. It holds `Select`, which is now built on Radix and keeps the previous look.

Import only the `UiKit` types in a browser bundle: an imported control would add a second copy of React.
