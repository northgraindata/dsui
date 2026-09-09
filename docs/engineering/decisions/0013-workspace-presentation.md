# 0013: Workspace presentation metadata

Status: Proposed
Owner: accountable DSUI maintainer
Review: Claude and human review required; changes remain uncommitted.

## Problem and constraints

The supplied Home, DuckDB query, and explorer references need connection context
and SQL column types. The renderer must remain provider independent and must not
derive SQL types from JSON values or access stored connection credentials.

## Decision

Add optional `connection` presentation metadata to the browser's `RendererClient`.
The web host supplies only the already-public service name and endpoint. This is
a browser component interface, not an SDK node or host execution protocol change.
DuckDB query results add optional `columnTypes`, aligned with existing `columns`.
The renderer validates results and displays types only when supplied by the adapter.
Query tabs and results are local to the mounted workbench; no persistence is promised.

## Alternatives

Guessing database types from JSON loses BIGINT, decimal and timestamp semantics.
Putting provider dispatch in the browser violates package ownership. A new
generalized workspace wire protocol is unnecessary for these presentation changes.

## Compatibility and rollout

`SplitPane` adds optional `inspector` nodes to SDK props and the core wire type.
The existing serializer recursively applies the same rules as for content and
sidebar nodes; no new executable fields are allowed. The renderer owns the third
rail and its responsive stacking. Existing split panes remain two columns.
SDK consumers may add `inspector: KeyValue({ title: "Details", data })` without
changing existing nodes. Older renderers ignore this optional presentation rail;
deploy the host and web bundle together to see it. This replaces the alternative
of having browser code infer provider-specific details from operation names.

Both additions are optional. Existing renderer clients and adapter test doubles
remain valid. Existing `columns`, `rows`, and action references retain their meaning.
No credentials, execution policy, database migrations, or dependencies change.

## Verification

Renderer tests cover empty results, legacy results, malformed rows and CSV export.
DuckDB tests verify column metadata with a real in-memory connection. Root checks,
production builds and browser checks cover the resulting UI.

## Consequences

Notebooks, unified activity, cost reporting and charts are presented as forthcoming.
Live service data takes precedence over illustrative reference names and metrics.
