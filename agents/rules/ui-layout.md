# UI layout contract

- Containers own the gaps between children. Components own their padding.
- Components set no outer margin. `PageHeader` is the one existing exception.
- A child never overrides a container's declared gap. Do not style a parent with `:has()` on its content.
- `Collection` and `Resource` are layout-neutral in every container (`LAYOUT_NEUTRAL_KINDS`).
- Grid and flex items may shrink (`min-width: 0`). Long values wrap or truncate and never widen the page.
- Wide content such as tables scrolls inside its own box. The page does not scroll sideways.
- Page content responds to the `dsui-page` container, never to the viewport.
- React keys come from position or identity, never from serialized content.
