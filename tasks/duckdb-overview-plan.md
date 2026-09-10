# Plan: DuckDB overview page

Spec: [duckdb-overview-spec.md](duckdb-overview-spec.md). Track acceptance in
[duckdb-overview-todo.md](duckdb-overview-todo.md). No commits until the user
says so. Sidebar/topbar/app shell are out of scope — overview content only.

## Sequence

1. **Slice 1 — `overview-nodes` (contract first).** Add StatGrid, Section,
   CardList, ActionList + PageHeader badge/meta to `nodes.ts`; wire
   serialization; document in SDK guides; contract tests. Land decision
   record 0015 alongside (contract changes require one).
2. **Slice 2 — `overview-data`.** Extend `overview` resource (threads,
   total size); add `databaseStats` (per-db schema/table/view counts),
   `tableRowCounts` (cached exact `COUNT(*)`, TTL 60s), `storageSummary`
   (real file size); `recentTables` (tables + cached counts, no
   last-accessed); reuse `queryHistory` for recent queries. Real-instance
   tests incl. cache expiry.
3. **Slice 3 — `overview-render`.** Renderer views + `ui` styles for the four
   new nodes and the PageHeader extension; type tests; typecheck. Parallel
   with slice 2 (contract is fixed by slice 1).
4. **Slice 4 — `overview-page`.** Rewrite `overviewPage` in `databases.ts`;
   page render + serialize test; refresh adapter docs page if it mirrors
   the overview.
5. **Slice 5 — verification.** Affected package checks, web build, manual
   eyeball in the review app against the mock (recorded, not automated).

## Risks

- `COUNT(*)` over many/large tables on every load → mitigated by 60s cache
  + run-query invalidation; if the review app feels slow, follow up with
  top-N or estimated counts (do not silently switch semantics).
- New-node API churn across SDK/renderer/adapter → mitigated by
  contract-first slice 1 with tests before any consumer exists.
- `⌘`-hint affordances without wiring → documented deferral, not silent.
- CardList serving two masters (databases + extensions) → keep its props
  generic (icon/title/badge/meta/link); reject adapter-specific fields.

## Decisions and risks

Contract shape disputes resolve toward fewer, more generic nodes. Any slice
that wants a fifth node or an existing-prop change beyond PageHeader must
come back for approval first.
