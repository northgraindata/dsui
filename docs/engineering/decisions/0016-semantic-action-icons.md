# 0016: Semantic action icons in declarative pages

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

Declarative adapter pages can label buttons and table-row actions but cannot add
the compact visual cues expected in an operational UI. Inferring icons from an
adapter id, action id, or label would leak provider conventions into the generic
browser renderer. Allowing adapters to send SVG or markup would cross the
presentation and trust boundary.

## Decision

Add an optional `icon` property to SDK `ButtonProps`, SDK `TableRowAction`, and
their browser-safe core documents. Its value is a closed semantic union: `play`,
`pause`, `resume`, `retry`, or `clear`. The SDK serializer copies only that name.
The renderer owns the corresponding SVG paths and renders them as decorative
content beside the existing visible label.

Existing button variants and action execution semantics remain unchanged. Row
actions also show an explicit in-progress label while their existing disabled
state prevents repeat activation.

## Alternatives

- Infer icons from action ids or labels: rejected because it couples generic UI
  to provider naming and fails for third-party adapters.
- Serialize SVG, HTML, or URLs: rejected because adapters provide intent rather
  than executable or presentational content.
- Add Airflow-specific React components: rejected because browser rendering must
  remain adapter-neutral.
- Use icon-only buttons: rejected because visible labels improve comprehension
  and reduce accessibility risk, especially for destructive actions.

## Compatibility and rollout

The property is additive and optional. Existing adapter nodes serialize and render
unchanged. Older page documents without `icon` remain valid. Adapters can adopt
the semantic names incrementally without a protocol version fork.

## Verification

SDK tests cover construction and lossless serialization with and without icons.
Renderer tests cover allowlisted SVG output, visible labels, and iconless output.
Airflow page tests assert that Trigger, Pause, Unpause, Retry, and Clear declare
the intended semantic icons.

## Consequences

Adding another icon requires a deliberate shared-contract addition and renderer
implementation. The small vocabulary is intentionally less flexible than arbitrary
icon assets and keeps the protocol safe and visually consistent.
