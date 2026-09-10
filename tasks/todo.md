# Airflow 3 adapter checklist

## Task 1: Establish the Airflow HTTP boundary

**Description:** Scaffold the workspace package and implement a per-instance,
bearer-authenticated Airflow 3 client boundary using test-first development.

**Acceptance criteria:**

- [x] `baseUrl` and `token` are validated and URLs resolve under `/api/v2`.
- [x] Responses are Zod-validated; HTTP/JSON/schema failures are explicit and
      secret-free.
- [x] Requests are bounded where applicable and abort on instance disposal.

**Verification:**

- [x] RED then GREEN: `bun test packages/adapter-airflow/test/client.test.ts`
- [x] `bun run --filter @northgraindata/dsui-adapter-airflow typecheck`

**Dependencies:** None

**Files likely touched:**

- `packages/adapter-airflow/package.json`
- `packages/adapter-airflow/tsconfig.json`
- `packages/adapter-airflow/src/context.ts`
- `packages/adapter-airflow/src/client.ts`
- `packages/adapter-airflow/test/client.test.ts`

**Estimated scope:** Medium

## Task 2: Deliver DAG catalog and graph data

**Description:** Add DAG list/details/tasks client methods, resources, pages, and
stateful fake behavior, including a dependency-table Graph tab.

**Acceptance criteria:**

- [x] `/dags` binds a bounded DAG list and deep-links encoded DAG ids.
- [x] `/dags/:dagId` shows Details, Graph, and Runs tabs.
- [x] Graph rows preserve operator and upstream/downstream task ids.

**Verification:**

- [x] RED then GREEN: focused DAG tests in `test/client.test.ts` and
      `test/adapter.test.ts`
- [x] Package test and typecheck pass.

**Dependencies:** Task 1

**Files likely touched:**

- `packages/adapter-airflow/src/client.ts`
- `packages/adapter-airflow/src/fake-client.ts`
- `packages/adapter-airflow/src/resources/dags.ts`
- `packages/adapter-airflow/src/pages/dags.ts`
- `packages/adapter-airflow/test/adapter.test.ts`

**Estimated scope:** Medium

## Checkpoint: Catalog

- [x] Package tests pass.
- [x] Package typecheck passes.
- [x] DAG bindings and malformed responses are covered.

## Task 3: Deliver runs, task instances, and logs

**Description:** Add the complete read path from a DAG's runs through one run's
task instances to mapped task details and an explicit task-log try.

**Acceptance criteria:**

- [x] Run and task rows preserve composite identifiers and deep-link correctly.
- [x] Detail resources expose documented state/timing metadata.
- [x] Task logs request explicit `tryNumber`, `mapIndex`, and full content.

**Verification:**

- [x] RED then GREEN: focused run/log tests.
- [x] Package test and typecheck pass.

**Dependencies:** Tasks 1–2

**Files likely touched:**

- `packages/adapter-airflow/src/client.ts`
- `packages/adapter-airflow/src/fake-client.ts`
- `packages/adapter-airflow/src/resources/runs.ts`
- `packages/adapter-airflow/src/pages/runs.ts`
- `packages/adapter-airflow/test/adapter.test.ts`

**Estimated scope:** Medium

## Task 4: Deliver DAG mutations

**Description:** Add trigger, pause, and unpause actions plus their declarative
page controls and resource invalidation.

**Acceptance criteria:**

- [x] Trigger accepts a JSON-object configuration and sends `logical_date: null`.
- [x] Pause/unpause changes fake and real-client state through PATCH.
- [x] Confirmed mutations invalidate only relevant DAG/run bindings.

**Verification:**

- [x] RED then GREEN: focused DAG-action tests.
- [x] Package test and typecheck pass.

**Dependencies:** Tasks 2–3

**Files likely touched:**

- `packages/adapter-airflow/src/client.ts`
- `packages/adapter-airflow/src/fake-client.ts`
- `packages/adapter-airflow/src/actions/dags.ts`
- `packages/adapter-airflow/src/pages/dags.ts`
- `packages/adapter-airflow/test/adapter.test.ts`

**Estimated scope:** Medium

## Task 5: Deliver task retry and clear

**Description:** Add single-task retry/clear actions over Airflow's clear API and
connect them to task-instance rows/details.

**Acceptance criteria:**

- [x] Retry affects only a failed selected task and uses `only_failed: true`.
- [x] Clear affects the selected task regardless of state.
- [x] Both use `dry_run: false`, reset the run, preserve mapped identity in the
      adapter input, and invalidate affected run/task resources.

**Verification:**

- [x] RED then GREEN: focused task-action tests.
- [x] Package test and typecheck pass.

**Dependencies:** Task 3

**Files likely touched:**

- `packages/adapter-airflow/src/client.ts`
- `packages/adapter-airflow/src/fake-client.ts`
- `packages/adapter-airflow/src/actions/tasks.ts`
- `packages/adapter-airflow/src/pages/runs.ts`
- `packages/adapter-airflow/test/adapter.test.ts`

**Estimated scope:** Medium

## Checkpoint: DAG lifecycle

- [x] Browse → trigger → inspect → retry/clear passes through the SDK runtime.
- [x] Mutation request bodies and invalidation scopes are tested.
- [x] Instance isolation and disposal are tested.

## Task 6: Deliver assets

**Description:** Add bounded asset list/details/events reads and list/detail pages.

**Acceptance criteria:**

- [x] `/assets` lists assets and links numeric ids to detail pages.
- [x] `/assets/:assetId` exposes details and recent events.
- [x] Empty, malformed, and 100-record boundary responses are covered.

**Verification:**

- [x] RED then GREEN: focused asset tests.
- [x] Package test and typecheck pass.

**Dependencies:** Task 1

**Files likely touched:**

- `packages/adapter-airflow/src/client.ts`
- `packages/adapter-airflow/src/fake-client.ts`
- `packages/adapter-airflow/src/resources/assets.ts`
- `packages/adapter-airflow/src/pages/assets.ts`
- `packages/adapter-airflow/test/adapter.test.ts`

**Estimated scope:** Medium

## Task 7: Finalize composition and delivery documentation

**Description:** Register every primitive in the adapter composition root, prove
the default adapter uses the real client, and document connection/scope limits.

**Acceptance criteria:**

- [x] Metadata, connection method, resources, actions, and routes are complete.
- [x] Default wiring contacts Airflow while tests inject isolated fakes.
- [x] README documents Airflow 3 `/api/v2`, JWT, limits, and graph presentation.

**Verification:**

- [x] RED then GREEN: `test/wiring.test.ts` and composition assertions.
- [x] Package test and typecheck pass.

**Dependencies:** Tasks 2–6

**Files likely touched:**

- `packages/adapter-airflow/src/adapter.ts`
- `packages/adapter-airflow/test/wiring.test.ts`
- `packages/adapter-airflow/test/adapter.test.ts`
- `packages/adapter-airflow/README.md`
- `packages/adapter-airflow/package.json`

**Estimated scope:** Medium

## Task 8: Verify and review

**Description:** Format only touched files, inspect the full diff, and execute the
repository's package and root verification commands.

**Acceptance criteria:**

- [x] No unrelated work, secrets, dead code, skipped tests, or silent fallbacks.
- [x] Actual command outcomes and remaining limitations are recorded below.

**Verification:**

- [x] `bun run --filter @northgraindata/dsui-adapter-airflow test`
- [x] `bun run --filter @northgraindata/dsui-adapter-airflow typecheck`
- [x] `bun run check` (ran; stopped at unrelated `.agents/skills` Biome errors)
- [x] `bun run build`
- [x] `git diff --check`

**Dependencies:** Tasks 1–7

**Files likely touched:**

- `tasks/todo.md`

**Estimated scope:** Small

## Checkpoint: Complete

- [x] All approved capabilities are implemented and registered.
- [x] Focused and root verification outcomes are recorded.
- [x] Final diff is ready for accountable human review.

## Verification outcomes

- Airflow package tests: 27 passed, 0 failed (112 assertions across 3 files),
  including credential-free demo wiring.
- Airflow package typecheck: passed.
- Root build: passed (4 build targets).
- Root check: stopped during Biome on pre-existing `.agents/skills/**` findings.
- Root typecheck: Airflow passed; root failed in
  `apps/site/src/components/originkit/ui/dither-reveal.tsx` because React types are
  unavailable there.
- Root tests: Airflow and web tests passed; root failed on the existing DuckDB
  connection-method expectation in `packages/server/test/loader.test.ts`.
- `git diff --check`: passed after normalizing these task files.
- `bun.lock` was not regenerated: Bun could not write its temporary install files
  in this sandbox, and the alternate temporary directory required unavailable
  network resolution. The lockfile was not hand-edited.

## Airflow 2.10 extension

- [x] Add the `airflow-2` connection method and `/api/v1` Basic-auth transport.
  - Acceptance: existing Airflow 3 configs remain valid; Airflow 2 credentials
    select `/api/v1` without probing.
  - Verify: focused wiring/client tests and package typecheck.
- [x] Normalize Airflow 2 provider resources and mutations.
  - Acceptance: DAGs, tasks, runs, task instances, logs, datasets, and existing
    mutations satisfy the current `AirflowClient` contract.
  - Verify: focused Airflow 2 client tests, then the package test suite.
- [x] Update documentation and complete repository verification.
  - Acceptance: README describes both connection methods and Airflow 2.10 scope;
    the final diff is focused and reviewable.
  - Verify: `bun run check`, `bun run build`, and `git diff --check`.

Observed verification: focused Airflow 2 client, wiring, and server-catalog
tests, the full Airflow package suite, and its typecheck passed; the root build
and diff check passed. The root test run reaches one unrelated existing DuckDB
connection-method expectation failure. The root check remains blocked by
existing `.agents/skills/**` Biome findings, and the root typecheck still fails
on the existing site React-type issue recorded above.

## Airflow action presentation extension

### Task 9: Add the semantic icon contract

**Description:** Record and implement an optional, allowlisted semantic icon on
button and table-row action documents.

**Acceptance criteria:**

- [x] SDK authors can declare `play`, `pause`, `resume`, `retry`, or `clear`.
- [x] Serialization preserves the icon and existing iconless nodes are unchanged.
- [x] The wire carries only a semantic name, never markup or SVG paths.

**Verification:** focused SDK node/serialization tests and SDK typecheck.

**Dependencies:** Approved action-presentation spec.

**Files likely touched:** core page document, SDK node types, serializer, colocated
tests, and decision record 0016.

**Estimated scope:** Medium

### Task 10: Render accessible action icons and progress

**Description:** Add renderer-owned icon paths to buttons and row actions while
retaining visible labels and showing an explicit busy state.

**Acceptance criteria:**

- [x] Declared icons render as decorative SVG beside visible action labels.
- [x] Row actions disable and communicate progress while executing.
- [x] Iconless buttons retain their current output and interaction.

**Verification:** focused renderer tests and renderer typecheck.

**Dependencies:** Task 9.

**Files likely touched:** renderer action icon component, page-node renderer,
resource views, and focused tests.

**Estimated scope:** Medium

### Checkpoint: Shared presentation

- [x] SDK and renderer tests/typechecks pass.
- [x] No adapter/action-id branching or executable presentation crosses the wire.

### Task 11: Polish Airflow declarative pages

**Description:** Apply concise descriptions, curated columns, section titles,
button variants, and semantic icons to Airflow pages.

**Acceptance criteria:**

- [x] Trigger, Pause, Unpause, Retry, and Clear show icons plus visible labels.
- [x] DAG/run/task/asset/event tables expose concise, readable columns.
- [x] Details, loading, empty, and error states remain usable; narrow layouts are
      covered structurally but could not be visually inspected in this session.

**Verification:** Airflow page serialization tests, package test, and typecheck.

**Dependencies:** Tasks 9–10 and the Airflow 2 normalization slice.

**Files likely touched:** Airflow DAG/run/asset pages and adapter tests.

**Estimated scope:** Medium

### Task 12: Verify the completed Airflow experience

**Description:** Update Airflow documentation and verify the add-service and
operational-page flows in tests and the browser.

**Acceptance criteria:**

- [x] Documentation describes Airflow 2.10 and 3 credentials and UI capabilities.
- [x] Add-service offers both versions with the correct fields in catalog and
      wiring tests.
- [ ] Browser checks cover keyboard focus and 320/768/1024/1440px layouts.

**Verification:** focused web tests/typecheck, `bun run check`, `bun run build`,
browser screenshots, and `git diff --check`.

**Dependencies:** Tasks 9–11 and all Airflow 2 tasks.

**Files likely touched:** Airflow README, decision/spec/task artifacts, and only
test files needed by observed regressions.

**Estimated scope:** Medium

### Checkpoint: Airflow 2 and UI complete

- [ ] All approved success criteria are demonstrated; live browser verification
      remains unavailable because no in-app browser target was attached.
- [x] Full diff preserves unrelated work and is ready for human review.

## Airflow live run graph extension

### Task 13: Carry live graph intent across the page contract

- [x] Serialize polling metadata, successful-action links, and graph state fields.
- [x] Validate absolute destinations and URL-encode fields from successful action
      results.
- [x] Cover the additive SDK and renderer contracts with focused tests.

### Task 14: Open and monitor the triggered run

- [x] Trigger actions on both DAG pages declare the returned run destination.
- [x] The run page opens with Graph selected before Details and Tasks.
- [x] A bounded derived resource joins DAG edges with task-instance state,
      including individual mapped instances and not-yet-created tasks.
- [x] Graph reads poll serially every two seconds and stop after unmount.
- [x] Nodes show state text plus semantic color; running motion respects reduced
      motion.

### Task 15: Verify the live workflow

- [x] SDK, renderer, Airflow, and web focused checks pass; server typecheck passes.
- [x] Production build and changed-file Biome checks pass.
- [x] Local HTTP integration demonstrates trigger output, run-first graph page,
      and `running/queued` changing to `success/running` on the next graph read.
- [ ] In-app browser screenshot and keyboard checks; no browser target was
      available in this session.
- [ ] Root `check`; existing `.agents/skills/**` Biome findings stop lint before
      typecheck/tests. Separate root typecheck/test failures remain in the site
      React setup, Airflow fetch-mock isolation, and DuckDB expectation.
- [ ] Full server test suite; 26 tests pass and the existing DuckDB
      connection-method expectation fails because four newer methods are present.
