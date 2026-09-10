# 0015: Overview page nodes (StatGrid, Section, CardList, ActionList)

Status: Proposed
Owner: accountable maintainer
Review: PR

## Problem and constraints

The DuckDB overview mock needs stat cards, titled panels, entity cards,
and quick actions. The SDK has `Table`, `KeyValue`, `Tabs`, and `Button`
but no generic node for any of them, and adapters must not ship markup
(architecture). The header also needs actions, which the authoring type
allows but serialization rejects.

## Decision

Add four generic SDK nodes with wire types in core, factories in the SDK,
and serialization: `StatGrid` (record fields → value/label cards),
`Section` (heading + optional link + nested content), `CardList`
(card-shaped resource rows or static cards with badges, meta lines, and
row links), `ActionList` (link or action items with display-only kbd
hints), plus `Columns` (weighted side-by-side panels collapsing to one
column on narrow screens — required for the mock's paired sections;
`SplitPane` is nav/content and semantically wrong there) and `Meter`
(labeled byte segments, e.g. measured table allocation vs the file
remainder vs free disk space). Meter segments carry a tone (including
`deep` `#142942`) and an optional `legend: false` to keep a segment in
the bar but out of the legend; the header shows legend-sum over bar
total. Table allocation is measured from distinct storage blocks, never
split into indexes vs metadata — DuckDB does not expose those — so the
file remainder is one honest bucket.
`CardList` takes an optional fixed `columns` count.
Extend `PageHeader` with status badge, meta line, and serialized
actions; extend `Button` with a page `link` alternative to `action`.
Renderer views land in the next slice; until then the new kinds render
empty and no adapter page uses them, so current pages are unaffected.

## Alternatives

- Stretching `Table`/`KeyValue` to render cards: rejected, it would leak
  presentation modes into the workhorse nodes every adapter relies on.
- One mega `Dashboard` node: rejected, adapter-specific and unusable by
  the next adapter.
- Doing less (headers + tables only): rejected, it cannot reach the
  approved mock.

## Compatibility and rollout

Additive contract: four kinds, two prop extensions, no removals. The
public-export freeze test is updated deliberately in this change.
Rollback: delete the nodes; no consumer exists yet.

## Verification

SDK contract tests (valid/invalid/empty/boundary), serialize round-trips,
frozen-API test, SDK + core typechecks. Renderer and adapter slices
verify their layers separately.

## Consequences

`ActionList` kbd hints are display only; shortcut wiring is a follow-up
(it touches app-level key handling). `CardList` meta lines are plain
strings; per-line icons would need a contract extension with a renderer
story. Renderer must implement the four views before the overview page
can ship (next slice).
