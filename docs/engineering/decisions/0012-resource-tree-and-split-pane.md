# 0012: Resource tree and split-pane page primitives

Status: Proposed
Owner: accountable maintainer

## Problem and constraints

Database adapters need a persistent database → schema → object explorer beside
object details. Tables force a page transition at every level, while the existing
query-workbench tree cannot navigate or compose with arbitrary page content.
Adapters must remain declarative and cannot ship HTML, CSS, or browser callbacks.

## Decision

Add two additive page-node contracts:

- `resource-tree` recursively binds resource-backed levels, display/type fields,
  optional row links, selected path, and a renderer state key.
- `split-pane` composes ordinary nodes into sidebar and content regions.

The renderer owns lazy loading, expansion, search, focus, responsive layout, and
state persistence. Adapters own resources and route templates. External rows never
cross into stores merely to render the tree.

## Alternatives

- DuckDB-specific renderer code violates adapter ownership.
- More tables and routes preserve the current disorienting workflow.
- Expanding `QueryWorkbench` into a general page shell couples catalog navigation
  to SQL execution.

## Compatibility and rollout

Both node kinds are additive. Existing adapters and serialized pages remain valid.
Core, SDK, serializer, renderer, documentation, and one reference adapter land in
the same change. Removing either node later would require an SDK compatibility
decision.

## Verification

SDK construction, serialization, negative type tests, renderer typechecks, DuckDB
route serialization, keyboard interaction tests where supported, and production
build.

## Consequences

The page protocol gains two stable concepts. Search initially covers loaded tree
branches; global server-side catalog search remains separate. Renderer state is
browser-session state and does not become adapter session data.
