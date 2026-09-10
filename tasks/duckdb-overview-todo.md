# DuckDB overview — task checklist

Plan: [duckdb-overview-plan.md](duckdb-overview-plan.md). Spec:
[duckdb-overview-spec.md](duckdb-overview-spec.md).

- [x] Slice 1: `overview-nodes` contract
  - Acceptance: StatGrid, Section, CardList, ActionList + PageHeader
    badge/meta typed, serialized, documented; 0015 written.
  - Verify: SDK tests (74 pass) + typecheck green; biome clean.
  - Files: `packages/adapter-sdk/src/components/nodes.ts`,
    `serialize.ts`, tests, docs guides,
    `docs/engineering/decisions/0015-duckdb-overview-nodes.md`.
  - Note: Button gained an optional page `link`; page-header actions
    now serialize (previous throw removed). Renderer renders the new
    kinds as empty until slice 3; no page uses them yet.
- [x] Slice 2: `overview-data` resources
  - Acceptance: extended `overview`, new `databaseStats`,
    `tableRowCounts` (cached), `storageSummary`, `recentTables`;
    history reused for recent queries.
  - Verify: adapter tests (31 pass: exact counts, execute-invalidation,
    ordering, limit) + typecheck; biome clean.
  - Files: `packages/adapter-duckdb/src/resources/catalog.ts`,
    `history.ts` (read-only), client methods, adapter tests.
  - Note: row-count cache is TTL 60s in-client, cleared on every
    `execute()`; TTL expiry itself is time-based (not unit-tested).
- [x] Slice 3: `overview-render` views
  - Acceptance: StatGrid/Section/CardList/ActionList/Columns render per
    DESIGN.md tokens; keyboard/focus/empty states sane.
  - Verify: renderer tests + typecheck; web build bundles.
  - Files: `packages/renderer/src/*`, `packages/ui/src/workspace.css`.
  - Note: `Columns` node added (plan deviation, approved in chat) —
    section pairing is impossible 1:1 without it; `SplitPane` is
    nav/content. Contract + tests + 0015 updated accordingly.
- [x] Slice 4: `overview-page` composition
  - Acceptance: `/` renders all 8 sections live; serializes clean.
  - Verify: adapter page test + full affected checks.
  - Files: `packages/adapter-duckdb/src/pages/databases.ts`, adapter docs.
  - Note: slice-2 bleeds folded in — `schemas` on overview,
    `databaseCards`/`extensionCards`/`recentQueries` shaping resources
    (contract stays dumb, adapter shapes data). Header meta omitted
    (no truthful compose-time source); header overflow menu omitted
    (no primitive); recent queries use Table (slim header deviation);
    attach targets `/admin` where the form lives.
- [x] Slice 5: verification pass
  - Acceptance: affected checks green; mock-vs-app eyeball recorded
    section by section.
  - Verify: SDK 76, adapter 33, renderer 9, web 17 tests pass;
    typechecks clean; biome clean; web build bundles. Review server
    restarted with fresh code for the manual eyeball (yours —
    no browser automation per instruction).
