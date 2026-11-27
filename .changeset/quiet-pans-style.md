---
"@northgraindata/dsui-adapter-sdk": minor
---

The SDK stylesheet now ships the styles of every builtin component. Before, most of them lived in the private renderer package, and imports after the first rule were ignored.

Breaking for custom components that targeted internal class names: all of them are now prefixed with `dsui-` (`layout-card` is `dsui-card`, `ov-meter` is `dsui-meter`, `explorer-layout` is `dsui-split`). Unused `ov-card*`, `ov-page*` and `query-data-table` rules were removed.

Colors come from semantic `--color-*` tokens, and layout gaps from `--spacing-*` tokens.
