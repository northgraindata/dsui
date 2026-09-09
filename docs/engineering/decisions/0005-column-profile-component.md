# 0005: ColumnProfile component and contract

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

The DuckDB UI's Table Summary and Column Explorer show per-column statistics (type,
count, null percentage, distinct count, min/max/avg, quartiles). The data is cheap to
obtain (`SUMMARIZE` is built into DuckDB), but there is no way to render it. It must
be reusable across adapters, so it belongs in the shared SDK/renderer layer, not in
the DuckDB adapter.

## Decision

Add a generic `ColumnProfile({ source })` component factory producing a
`column-profile` node, backed by a `ColumnProfileRow` contract owned by
`packages/core`. The DuckDB adapter exposes `column-profile` and `result-profile`
resources that map `SUMMARIZE` output into `ColumnProfileRow[]`. The renderer renders
per-column stat cards (type, null %, distinct, min/max/avg, quartiles) with compact
distribution bars where the data supports them.

## Alternatives

- **A `Table` variant**: overloads an existing node instead of a focused kind;
  rejected for clarity.
- **Adapter-private component**: adapters must not supply renderers; rejected.
- **Raw table of stats**: acceptable interim but does not meet the "Column Explorer"
  requirement.

## Compatibility and rollout

A new node kind requires renderer support and an exhaustive `ComponentNode` union
case (a compile-time check). Existing adapters are unaffected. True histograms
(`histogram()`) and chart rendering are follow-ups; v1 uses `SUMMARIZE`-derived
statistics.

## Verification

`SUMMARIZE` → `ColumnProfileRow` mapping tests against a real in-memory DuckDB
instance; node serialization tests; renderer render/interaction tests including
empty and missing column cases.

## Consequences

The contract must stay presentation-agnostic (typed statistics, not markup).
Histograms and interactive charting remain SDK gaps tracked elsewhere.
