---
"@northgraindata/dsui-adapter-sdk": minor
---

Layout follows one contract: containers own the gaps between children, and a declared gap is never overridden by a child.

- `Grid` no longer changes its gap and column width when it contains a metric card. Pass `minColumnWidth: "sm"` for grids of metric tiles.
- `Columns` accepts `gap` (default `"md"`, 16px, previously a fixed 14px) and stacks when the page container is narrower than 720px.
- `SplitPane` passes context to its panes and accepts `sidebarLabel`.
- `Stack`, `Flex`, `Grid` and `Columns` treat `Collection` and `Resource` as layout-neutral.
- Pages respond to their own width instead of the viewport, so split workspaces lay out correctly.
- Re-rendering a page with changed props keeps component state.
