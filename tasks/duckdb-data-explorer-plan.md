# Implementation Plan: Snowflake-style DuckDB data explorer

## Overview

Replace the current sequence of database, schema, and relation tables with a
persistent two-pane explorer. The left pane keeps users oriented in the full
DuckDB catalog; the right pane shows the selected object's details without
hiding the hierarchy. Attached databases participate in the same tree.

The implementation remains declarative: the SDK gains reusable layout and tree
primitives, the renderer owns interaction and accessibility, and the DuckDB
adapter supplies resource bindings and routes.

## Target experience

- `/data` opens with a persistent tree: database → schema → table/view.
- Databases and schemas expand in place. Selecting a relation changes the URL and
  right pane while preserving expansion, scroll position, and search.
- Tables and views coexist, with compact type icons/labels and the selected row
  visibly highlighted.
- Search filters the hierarchy by qualified name. Matching descendants keep
  their ancestors visible.
- The right pane uses the existing Overview, Data, Columns, Statistics, and DDL
  language. It never renders a second catalog table just to navigate deeper.
- On narrow screens the tree becomes a collapsible panel above the detail rather
  than compressing the data table.
- Keyboard users can traverse and expand the tree with standard tree semantics.

## Architecture decisions

- Add generic `ResourceTree` and `SplitPane` SDK components. DuckDB-specific HTML
  remains prohibited.
- Reuse the existing recursive resource-binding model from `QueryWorkbench` but
  promote it into a shared contract with leaf navigation and selection state.
- Keep selected objects in the URL. Expansion, search, and tree scroll are local
  renderer state, scoped by service and page family.
- Load child resources lazily on expansion. Do not fetch the entire catalog at
  startup.
- Keep relation metadata in resources and presentation state in the browser. No
  catalog rows move into adapter stores.
- Record the public SDK protocol addition in a decision record before landing the
  contract.

## Dependency graph

```text
SDK/core tree + split-pane contracts
              ↓
Renderer tree interaction and responsive layout
              ↓
DuckDB Data shell and route integration
              ├── table/view detail polish
              └── Query workbench tree reuse
              ↓
Catalog invalidation and end-to-end browser verification
```

## Task list

### Phase 1: Shared foundation

1. Define the explorer interaction contract and decision record.
2. Add serializable `ResourceTree` and `SplitPane` SDK/core nodes.
3. Render the tree with lazy expansion, selection, search, keyboard operation,
   loading/error/empty states, and responsive behavior.

### Checkpoint: Shared foundation

- SDK serialization/type tests and renderer interaction tests pass.
- A fixture page demonstrates nested expansion and leaf navigation.
- No adapter-specific markup or provider branching exists in the renderer.

### Phase 2: DuckDB vertical slice

4. Convert `/data` and its detail routes to one persistent explorer shell.
5. Polish database/schema/table/view detail content and selected-object context.
6. Reuse the same tree implementation inside the SQL workbench.

### Checkpoint: DuckDB workflow

- A user can expand `verification → main`, select `customers`, inspect Data and
  Columns, select `customer_revenue`, and return without losing tree state.
- Attached databases appear at the same level as the primary database.
- Tables and views have distinct non-color-only indicators.

### Phase 3: Freshness and polish

7. Invalidate catalog resources after worksheet DDL and attach/detach actions.
8. Add Home labeling, qualified-name copying, focus restoration, and mobile panel
   behavior using shared primitives.
9. Run browser accessibility, responsive, serialization, adapter, and build
   verification; update DuckDB `COVERAGE.md`.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Large catalogs make search expensive | High | Lazy-load branches, debounce local filtering, and avoid eager recursive requests. |
| Expansion disappears during navigation | High | Persist renderer tree state by service and `/data` route family. |
| Public node contract becomes DuckDB-shaped | High | Use generic row fields, recursive bindings, and route templates; test with a non-DuckDB fixture. |
| Narrow screens make the split pane unusable | Medium | Collapse the tree into an explicit, focus-managed panel below the desktop breakpoint. |
| DDL leaves stale objects visible | Medium | Invalidate relations, schemas, databases, and overview after successful arbitrary SQL. |
| Tree accessibility regresses | Medium | Implement WAI-ARIA tree keyboard behavior and test focus, arrows, Enter, and Escape. |

## Deferred scope

- Drag resizing, favorites, recently viewed objects, column-level search, lineage,
  and saved explorer filters.
- Data-grid sorting, filtering, and pagination; these remain separate `Table`
  capability work.
- Full in-memory query/session persistence, which is a server-owned adapter
  session project rather than an explorer presentation change.

## Verification commands

```sh
bun run --filter @northgraindata/dsui-adapter-sdk test
bun run --filter @northgraindata/dsui-adapter-sdk typecheck
bun run --filter @northgraindata/dsui-renderer test
bun run --filter @northgraindata/dsui-renderer typecheck
bun run --filter @northgraindata/dsui-adapter-duckdb test
bun run --filter @northgraindata/dsui-adapter-duckdb typecheck
bun run --filter @northgraindata/dsui-web test
bun run --filter @northgraindata/dsui-web typecheck
bun run build
```

## Open questions

- Should a schema click show schema details, or only expand/collapse it? Recommended:
  single click selects; the chevron independently expands.
- Should search query unloaded catalog branches server-side? Recommended MVP:
  search loaded branches plus a dedicated adapter search resource when the query
  has at least two characters.
