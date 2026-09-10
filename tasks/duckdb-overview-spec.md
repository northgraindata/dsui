# Spec: DuckDB overview page (mock parity, SDK-driven)

## Objective

Replace the DuckDB adapter `/` page (PageHeader + KeyValue + Tabs) with the
approved mock: header with actions, 6 stat cards, Attached databases, Quick
actions, Recent tables, Recent queries, Extensions, Storage usage. The page is
composed purely from SDK nodes — zero adapter markup — with real data
everywhere. Success: visual parity per section, all data live from DuckDB,
tests per layer, decision record for the new contract.

## Tech Stack

Bun 1.3.12, TypeScript, SDK `definePage`/`defineResource`, renderer package,
`ui` package. No new dependencies.

## Commands

```sh
bun run --filter @northgraindata/dsui-adapter-sdk test
bun run --filter @northgraindata/dsui-adapter-sdk typecheck
bun run --filter @northgraindata/dsui-adapter-duckdb test
bun run --filter @northgraindata/dsui-adapter-duckdb typecheck
bun run --filter @northgraindata/dsui-renderer test   # if exists, else bun test packages/renderer
bun run --filter @northgraindata/dsui-web build
```

## Project Structure

```text
packages/adapter-sdk/src/components/   → nodes.ts, serialize.ts (+tests), docs
packages/adapter-duckdb/src/resources/  → catalog.ts, history.ts (existing)
packages/adapter-duckdb/src/pages/      → databases.ts (overviewPage rewrite)
packages/renderer/src/                  → new views (+type tests)
packages/ui/src/                        → workspace.css additions
docs/engineering/decisions/0015-*.md    → contract decision record
tasks/duckdb-overview-plan.md           → slice plan
tasks/duckdb-overview-todo.md           → task checklist
```

## Code Style

New nodes follow the existing `nodes.ts` pattern — typed props, JSDoc with
`@example`, factory function, `readonly kind` discriminant:

```ts
StatGrid({
  source: overviewStats(),
  items: [
    { icon: "database", value: "size", label: "Database size" },
  ],
});
```

## Testing Strategy

Bun Test throughout. Contract tests per new node (valid/invalid/empty/
boundary), serialize round-trips, real in-memory DuckDB resource tests
(counts, cache TTL/expiry, storage size), adapter page render test
(`/` renders, serializes without throwing). Renderer: type-level tests +
typecheck; no DOM infra exists, so visual parity is verified by eyeball in
the review app (recorded as a manual step, not claimed as automated).

## Boundaries

- Always: typed contracts, Zod at resource edges, tests per slice, decision
  record for the contract change.
- Ask first: new dependencies, changing existing node props beyond the
  approved PageHeader extension, touching sidebar/topbar/app shell.
- Never: adapter-supplied markup/CSS/JS, hardcoded mock numbers, weakening
  caps or tests to pass, committing (user commits when ready).

## Success Criteria

- [ ] `/` renders all 8 mock sections with live data, no `SELECT 42`-style
  placeholders.
- [ ] New nodes: StatGrid, Section, CardList, ActionList; PageHeader gains
  optional status badge + meta line. Nothing else new.
- [ ] Row counts exact via cached `COUNT(*)` (TTL 60s, invalidated by
  run-query's existing broad invalidation).
- [ ] Storage shows real file size only (no breakdown, no quota).
- [ ] Full checks green for affected packages; web build bundles.

## Decisions baked in (confirm)

- "Last accessed" column omitted: DuckDB exposes no such source; inventing
  it violates the no-hardcoded-numbers rule.
- Quick-action `⌘` hints rendered, shortcut wiring deferred to a follow-up
  (wiring touches app-level key handling = out of scope).
- Section headers ("View all →", "Attach database +") are links to real
  adapter pages, carried by the new `Section` node.
