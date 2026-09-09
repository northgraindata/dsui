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

- Airflow package tests: 22 passed, 0 failed (79 assertions across 3 files),
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
