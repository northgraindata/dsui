# ClickHouse Workspace — Milestone 1 Tasks

## Task 1: Add the workspace navigation contract

**Acceptance criteria:**
- [x] Capability views may optionally declare an area and parent relationship.
- [x] The service manifest transports the metadata unchanged.
- [x] Capabilities without metadata remain valid.

**Verification:** focused core/server tests and `bun run typecheck`.

**Dependencies:** None.

**Files likely touched:** core contract, server manifest, server tests.

## Task 2: Render workspace areas

**Acceptance criteria:**
- [x] ClickHouse displays compact top-level areas.
- [x] The active area exposes only its relevant child views.
- [x] Adapters without areas retain flat navigation.

**Verification:** web unit tests and direct-route manual check.

**Dependencies:** Task 1.

**Files likely touched:** web API types, workspace navigation component/tests.

## Task 3: Browse databases and objects

**Acceptance criteria:**
- [x] Databases load independently from their child objects.
- [x] Tree search and loading/error/empty states work.
- [x] Selecting an object produces a direct URL.

**Verification:** ClickHouse adapter tests, web tests, mock browser check.

**Dependencies:** Task 2.

**Files likely touched:** ClickHouse adapter/tests, explorer component/tests.

## Task 4: Inspect overview and columns

**Acceptance criteria:**
- [x] Overview displays table metadata and storage estimates.
- [x] Columns display ClickHouse-specific type/default/codec/TTL/comment fields.
- [x] Inputs are validated and parameterized.

**Verification:** adapter RED/GREEN tests and browser check.

**Dependencies:** Task 3.

**Files likely touched:** ClickHouse adapter/tests, table workspace component.

## Task 5: Preview data and DDL

**Acceptance criteria:**
- [x] Preview defaults to 100 rows, supports offset pagination, and caps at 1000.
- [x] DDL is complete and copyable.
- [x] Identifier-like malicious input cannot alter the SQL statement.

**Verification:** adapter boundary tests and browser check.

**Dependencies:** Task 4.

**Files likely touched:** ClickHouse adapter/tests, table workspace component.

## Task 6: Inspect table parts

**Acceptance criteria:**
- [x] Active parts show partition, rows, bytes, marks, disk, and modification.
- [x] Results are bounded and paginated.

**Verification:** adapter tests and browser check.

**Dependencies:** Task 4.

**Files likely touched:** ClickHouse adapter/tests, table workspace component.

## Task 7: Add realistic ClickHouse mock data

**Acceptance criteria:**
- [x] Every explorer route renders meaningful ClickHouse-shaped data.
- [x] Empty and incident presets remain distinct.
- [x] Preview pagination is observable without a live database.

**Verification:** mock tests and end-to-end browser flow.

**Dependencies:** Tasks 3–6.

**Files likely touched:** mock emulator/fixtures/tests.

## Task 8: Browser and accessibility QA

**Acceptance criteria:**
- [ ] Keyboard, focus, loading, error, and empty states work.
- [ ] Layout works at 320, 768, 1024, and 1440 px.

**Verification:** browser walkthrough with screenshots and clean console.

**Dependencies:** Task 7.

**Files likely touched:** explorer/workspace UI and tests.

## Task 9: Final review and gate

**Acceptance criteria:**
- [x] Correctness, readability, architecture, security, and performance reviewed.
- [x] No unresolved required findings remain.

**Verification:** `bun run lint`, `bun run typecheck`, `bun run test`, and
`bun run build`.

**Dependencies:** Task 8.

**Files likely touched:** only files required by review findings.
