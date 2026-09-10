# Implementation Plan: Airflow 3 Adapter

## Overview

Add `@northgraindata/dsui-adapter-airflow` as a server-side workspace adapter
using only the public adapter SDK. The adapter targets Airflow 3.x's stable
`/api/v2` REST API and exposes bounded resources, scoped actions, and declarative
pages for DAGs, runs, task instances/logs, and assets.

The approved capability map and module specifications live in
`packages/adapter-airflow/`.

## Dependency Graph

```text
Airflow connection schema and HTTP boundary
├── DAG catalog resources/pages
│   └── trigger and pause/unpause actions
├── DAG run resources/pages
│   └── retry and clear task actions
├── asset resources/pages
└── adapter composition, fake client, wiring, and documentation
```

## Architecture Decisions

- Model Airflow as a new `packages/adapter-*` package; do not change the SDK,
  core wire contracts, renderer, or existing adapters.
- Use one per-instance `AirflowClient` interface. The production implementation
  owns authenticated fetch and Zod response parsing; the fake implements the same
  interface with isolated mutable state.
- Accept `baseUrl` and `token`. Normalize the base URL once, append `/api/v2`
  endpoints explicitly, and pass an instance-owned abort signal to every request.
- Return adapter-owned camelCase domain records rather than leaking Airflow's
  snake_case payloads beyond `client.ts`.
- Use `limit=100` and explicit ordering on list endpoints. Browser pagination is
  deferred because the current resource/table contract does not expose paging.
- Render a DAG graph as a dependency table from the public tasks endpoint. A
  visual graph would require a separate SDK/core/renderer protocol decision.
- Use Airflow's clear-task-instances endpoint for both retry and clear. Retry sets
  `only_failed: true`; clear sets it to false. Both are single DAG/run/task,
  `dry_run: false`, and reset the DAG run.
- Do not automatically retry mutations. A timeout leaves mutation outcome unknown.

## Vertical Slices

### Phase 1: Foundation and catalog

1. Scaffold the package and prove the authenticated HTTP boundary with failing
   transport tests, then implement connection validation, normalized URLs,
   response parsing, error sanitization, cancellation, and disposal.
2. Add the DAG catalog path end to end: client methods, fake behavior, resources,
   list/detail pages, and dependency-table graph.

### Checkpoint: Catalog

- Package tests and typecheck pass.
- `/dags` and `/dags/:dagId` bind only validated resources.
- Malformed Airflow payloads fail rather than rendering partial data.

### Phase 2: Operations and observability

3. Add run list/details, task instances, task-instance details, and explicit-try
   logs with deep links and polling appropriate to operational state.
4. Add trigger, pause, and unpause actions with narrow invalidation and page
   controls.
5. Add retry and clear task actions with single-instance scope and narrow
   invalidation.

### Checkpoint: DAG lifecycle

- The fake-client runtime test covers browse → trigger → inspect → retry/clear.
- Mutation bodies match Airflow 3 contracts and do not receive automatic retries.
- Two adapter instances remain isolated and disposal cancels owned requests.

### Phase 3: Assets and delivery

6. Add asset list/details/events resources and pages.
7. Finalize adapter registration, default real-client wiring, public exports, and
   package documentation.
8. Review the full diff and run focused package checks, relevant root checks, and
   the root build; record any pre-existing or environmental failures accurately.

### Checkpoint: Complete

- Every approved resource, action, and page is registered.
- Focused tests and typecheck pass.
- Root checks and build have been run, or any limitation is explicitly reported.
- The final diff contains no unrelated changes, secrets, fixtures used by default,
  skipped tests, casts hiding malformed data, or silent fallbacks.

## Testing Approach

Each behavioral slice follows RED → GREEN → REFACTOR:

1. Add a focused Bun test that fails because the capability is absent.
2. Implement the smallest client/resource/action/page path that satisfies it.
3. Run `bun run --filter @northgraindata/dsui-adapter-airflow test`.
4. Run the package typecheck after the slice compiles.

Transport tests stub `globalThis.fetch`, while adapter behavior tests use the real
SDK runtime with an isolated stateful fake. Tests cover valid, empty, malformed,
and boundary inputs; mutations assert resulting state rather than only call
counts. Runtime tests dispose scopes and instances in `finally` blocks.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Airflow 3 response fields differ across patch versions | High | Parse documented required fields and tolerate only explicitly optional documented fields; malformed fixtures must fail. |
| JWT expires outside the adapter | Medium | Surface a sanitized 401; token acquisition/refresh is a later auth method, not a silent fallback. |
| Large DAG/run/asset collections | Medium | Bound every list request to 100 and expose total entries where useful. |
| Mapped task identity is lost | High | Carry `mapIndex` through task rows, links, detail/log inputs, and actions. |
| Mutation timeout has unknown outcome | High | No automatic retries; refresh affected reads after confirmed success only. |
| No graph renderer exists | Medium | Provide the approved dependency table without changing shared contracts. |

## Open Questions

None. The capability map and all seven module specifications are approved.

## Airflow 2.10 extension

1. Add the versioned connection/authentication contract and failing transport
   tests for `/api/v1` with Basic authentication.
2. Normalize Airflow 2 DAG, task, run, task-instance, log, and dataset responses
   into the existing domain models, with focused client tests after each slice.
3. Update adapter wiring and user documentation, then run package and root
   verification and inspect the final diff.

The primary risk is accepting one version's payload as another's. Separate Zod
schemas at the HTTP boundary and fixtures taken from Airflow 2.10's stable OpenAPI
mitigate it. No SDK/core/renderer changes or new dependencies are required.

## Airflow action presentation extension

### Dependency graph

```text
Optional semantic icon contract in core
              ↓
SDK authoring type and serialization
              ↓
Renderer icon and busy-state presentation
              ↓
Airflow page columns, descriptions, and action declarations
              ↓
Browser accessibility and responsive verification
```

### Vertical slices

1. Record the additive wire-contract decision, then add optional semantic icons
   to button and table-row action documents and prove SDK serialization.
2. Render the allowlisted icons with visible labels and compact in-progress action
   controls; existing iconless adapter pages remain unchanged.
3. Curate Airflow page descriptions, detail titles, table columns, button variants,
   and icons for DAG, run, task, asset, and event workflows.
4. Update documentation and run focused package checks, browser verification at
   320px, 768px, 1024px, and 1440px, root checks, build, and final diff review.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Icon contract becomes an SVG injection surface | High | Serialize only a closed semantic-name union; renderer owns every path. |
| Action density harms accessibility | Medium | Keep visible labels, native buttons, focus styles, and non-color state cues. |
| Airflow page polish leaks provider logic into React | High | Airflow declares generic page props; renderer never branches on adapter or action ids. |
| Narrow tables overflow | Medium | Curate columns and preserve the existing horizontal-scroll container. |

The extension is additive: existing nodes omit `icon` and render as before. No new
page-node kind, dependency, route, or provider-specific browser component is added.

## Airflow live run graph extension

1. Extend the page contract additively with polling resource metadata,
   successful-action destinations, and graph state fields; prove serialization
   and safe result-link resolution first.
2. Join bounded DAG topology and task-instance reads in the Airflow adapter, then
   make the run page's first tab a state-aware graph.
3. Render state text and semantic cues, poll serially every two seconds while the
   graph is mounted, preserve the last good result on refresh failure, and cancel
   the next poll on unmount.
4. Verify focused packages, the real server boundary against a local fake Airflow
   API, root checks, build, and final diff.

The browser remains provider-neutral: Airflow mapping stays in the adapter, while
navigation, scheduling, cleanup, graph layout, and status presentation stay in the
renderer. Optional fields preserve existing adapter behavior.
