# 0009: Connection-method groups (sub-tabs)

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

Decision 0007 gives one flat tab per connection method. DuckDB's expansion
(decision 0008) needs twelve methods, most of them remote schemes (`s3`, `gcs`,
`r2`, `azure`, `https`, `quack`, `motherduck`, `postgres`, `mysql`, `sqlite`).
Twelve top-level tabs force users to scan scheme minutiae before understanding
the three real choices (local volatile, local file, remote). The grouping must
not complicate validation: the runtime already discriminates on a flat leaf
`method` id.

## Decision

Authors may nest methods one level under a group entry:

```ts
connectionMethods: {
  memory: { label: "In-memory", schema: memorySchema },
  remote: {
    label: "Remote",
    methods: { s3: { label: "S3", schema: s3Schema } },
  },
}
```

Groups are presentational only. `defineAdapter` flattens them to leaves tagged
with their group; `connectionSchema` stays a flat discriminated union over leaf
ids, so no `method` value ever names a group and the parsed config is unchanged.
The form renders top tabs (`memory`, `file`, `remote`) and, inside a selected
group, always renders the sub-tab strip — even for a single child — so the
grouping stays visible and new siblings slot in without layout changes. (The
"one option, no tabs" rule still applies when the adapter declares a single
leaf overall with no groups involved.)

Rules, enforced in `defineAdapter`: leaf and group ids share one kebab-case
namespace (a leaf may not shadow a group id); every group needs at least one
child; groups nest exactly one level; an entry declares either `schema` or
`methods`, never both nor neither.

DuckDB's `remote` becomes a group holding `s3` (same fields as before). Saved
`{ method: "remote", … }` connections become `{ method: "s3", … }`; acceptable
pre-1.0 and already foreseen by 0008's `remote`→`s3` migration note.

## Alternatives

- **Twelve flat tabs**: no SDK change, but the form becomes a scheme picker
  instead of a connection-mode picker; rejected.
- **A scheme dropdown inside one `remote` method**: reintroduces the guessing
  problem tabs solved (hidden fields per selection); rejected.
- **Two-level discriminator (`method` + `submethod`)**: doubles the config
  surface and migration cost for zero validation benefit; rejected.

## Compatibility and rollout

Additive: adapters without groups behave exactly as under 0007. The wire gains
an optional `group` on each method; old renderers ignore it and show flat tabs.
DuckDB migrates `remote`→`s3` now so the rename happens once.

## Verification

SDK tests cover flattening, leaf-union parsing, group-tag serialization, and
every rejection rule. Server loader tests assert leaf ids plus group tags. Web
tests cover top-entry derivation and first-leaf resolution; the tab strip
itself is exercised through the existing AddService flow.

## Consequences

Future P1 siblings (`gcs`, `r2`, `azure`, `quack`) slot into the `remote` group
with no contract changes — sub-tabs appear automatically. If a group ever needs
deeper nesting or per-group validation, that is a new decision, not an
extension of this one.
