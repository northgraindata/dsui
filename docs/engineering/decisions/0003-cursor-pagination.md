# 0003: Cursor pagination for table results

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

The `Table` component renders a full resource result with no paging, sorting, or
filtering, and no virtualization. Large result sets (a 10M-row DuckDB table) must
not be buffered or rendered in full. The architecture notes table power features as
an open gap and requires a shared, testable result contract rather than an
adapter-specific route. Client-side paging loads all rows and does not scale.

## Decision

Introduce a core `PaginatedResult<T> { rows: T[]; nextCursor: string | null }`
contract. A resource may accept optional `{ cursor?, limit? }` input and return a
`PaginatedResult`; the `Table` drives "load more" / page controls by re-executing
the binding through the runtime with the previous `nextCursor`. Client-side sort,
filter, column visibility, and DOM virtualization remain renderer concerns over the
already-fetched rows.

Ownership: the contract and validation live in `packages/core`; the runtime resolves
and re-executes paginated bindings in `packages/adapter-sdk`; the renderer
(`packages/renderer` + `apps/web`) owns the paging controls and virtualization.

## Alternatives

- **Client-side only**: fetch all rows and page in the browser; no SDK change but
  unbounded memory and no scaling.
- **Infinite scroll without a cursor**: offsets drift under concurrent writes;
  cursors are stable under append-only loads.
- **Adapter-specific paging**: rejected; violates the "no provider semantics in
  generic UI" rule.

## Compatibility and rollout

Additive: resources without `cursor` input are unchanged and render fully as today.
`TableProps` gains optional `pageSize`, `sortable`, `filterable`, and `virtualized`
(default true). Existing adapters and views keep their current behavior.

## Verification

Core contract validation tests (valid/malformed cursor), runtime re-execution tests
for a paginated binding, and renderer interaction tests for sort/filter/virtualize
and "load more". Boundary tests cover the terminal `nextCursor === null` case.

## Consequences

Streaming (paged-by-chunk over time) is not addressed here and remains a separate
gap. Cursors are opaque strings owned by the resource; the runtime treats them as
input to the next binding and never interprets them.
