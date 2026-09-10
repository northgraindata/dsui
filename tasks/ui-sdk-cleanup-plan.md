# Plan: SDK Components, Renderer Boundaries, and Web Product Cleanup

Status: Proposed for Claude and human review  
Scope: Planning only; no implementation or API migration is included in this document  
Pilot: `packages/adapter-duckdb`  
Follow-up: Implement as a sequence of focused PRs after this plan is accepted

## Intent

Make the OSS repository easy to understand by separating four things that are
currently mixed together:

1. The reusable visual primitives and design tokens owned by `packages/ui`.
2. The declarative adapter component vocabulary and page layouts owned by the
   SDK/core/renderer boundary.
3. The dsui product shell and product workflows owned by `apps/web`.
4. Provider-specific composites and workflows owned by an adapter, starting with
   DuckDB.

The desired authoring style is consistent: default adapter components and
adapter-specific components should be declared through the same component
definition mechanism. A reader should be able to recognize a component by its
definition, its ownership, and its renderer registration without learning a
second convention for built-ins.

This is a cleanup and boundary-setting effort. It must not silently expand the
product into a universal data catalog, replace the adapter model, or introduce a
browser-side extension model that bypasses the existing trust boundary.

## What was observed

The following observations are based on the current repository and the recent
component/renderer work. They are the problems this plan addresses, not claims
that the current implementation is the desired architecture.

## Simplification review required for every implementation phase

Use the Codebase Simplifier method as a mandatory review gate for this work. The
goal is fewer concepts required to understand the system, not fewer lines at
any cost.

Before changing a subsystem, the implementation PR must include a short
simplification report:

- Architecture summary in plain technical language.
- Dependency map covering entrypoints, package boundaries, public APIs, runtime
  flow, and tests.
- Complexity hotspots with location, current design, proposed simplification,
  behavioral risk, and blast radius.
- Priority for each proposal:
  - **P0:** obvious deletion or dead code.
  - **P1:** low-risk consolidation or duplication removal.
  - **P2:** architectural simplification.
  - **P3:** invasive redesign.

Implementation order is P0, then P1. P2 and P3 are proposals only until a human
maintainer explicitly approves them through the relevant contract or architecture
review. Preserve boundaries that isolate external APIs, persistence,
authentication/security, transactions, platform-specific code, independent
deployment, or genuinely different domain semantics.

For every abstraction under review, answer:

1. What problem does it solve today?
2. How many implementations and users does it have?
3. What becomes harder if it disappears?
4. Can the caller express the same behavior more clearly without it?

The final implementation report must list deleted files, merged files,
abstractions and dependencies removed, approximate LOC removed where useful,
tests run, remaining opportunities, and intentionally preserved complexity.

### SDK and page-node duplication

- `packages/adapter-sdk/src/components/nodes.ts` contains many unrelated
  concepts in one file: controls, data views, layouts, forms, workbenches,
  entity views, and custom nodes.
- The SDK has individual node interfaces and constructors for every hard-coded
  component, while `defineComponent` uses a different authoring path for named
  composites and browser components.
- `packages/core/src/page-document.ts` repeats a large discriminated union for
  the browser-safe form of those nodes. The SDK serializer then contains a
  second mapping for the same vocabulary.
- `EntityCatalog` and `EntityDetail` live beside generic SDK components even
  though the current concrete consumer is DuckDB extension management.
- `QueryEditor` is represented as a generic page node even though the
  current product behavior is a DuckDB SQL workflow.

### Renderer ownership is hard to discover

- `packages/renderer` is a useful package boundary, but its files mix generic
  page rendering, overview views, entity primitives, entity workflows, and the
  component registry.
- First-party views are registered partly by importing modules for side effects
  and partly by calling `registerView` in `page-node-renderer.tsx`.
- `EntityPrimitives.tsx`, `EntityViews.tsx`, and `OverviewViews.tsx` do not make
  the generic-versus-product-specific split obvious from their location.
- The current registry and page renderer already provide the shape needed for a
  common component-definition convention, but the SDK node union and renderer
  registration model do not yet use one vocabulary consistently.

### The web product is concentrated in the root surface

- `apps/web/src/screens.tsx` is approximately 2,500 lines and contains routing
  screens, app shell behavior, adapter workspace behavior, query/table views,
  connection workflows, authentication, and several data transformations.
- `apps/web/src/workspace.css` and `connections.css` contain large product
  surfaces with overlapping shell, layout, connection, and feature styling.
- `apps/web/src/components` contains a mixture of shells, layouts, feature
  components, and low-level display components without a visible convention.
- The app still has legacy operation-name/positional-row assumptions in the web
  path, while the declarative renderer uses the newer page-document path.

### DuckDB is the right boundary test

- DuckDB pages already show the desired declarative readability: pages compose
  `PageHeader`, `Table`, `Tabs`, `Section`, `Columns`, `SplitPane`, and related
  pieces.
- `packages/adapter-duckdb/src/components/data-explorer.ts` is a good example of
  an adapter-owned composition built from reusable primitives.
- `QueryEditor`, entity catalog/detail views, extension management, and the
  data explorer are provider workflows with different reuse prospects. They are
  a useful test for deciding what remains generic and what moves to DuckDB.

## Architectural vocabulary

The plan uses these terms consistently.

| Term | Meaning | Owner | Examples |
| --- | --- | --- | --- |
| UI primitive | React visual building block with no adapter/resource semantics | `packages/ui` | `Button`, `Surface`, `Field`, `DataTable`, `Status` |
| Adapter primitive | Declarative component available to every adapter; it describes intent and may bind resources/actions | SDK + core contract + renderer | `Table`, `KeyValue`, `Tabs`, `Form`, `TextInput` |
| Layout | Declarative composition that controls page structure, not provider meaning | SDK + renderer | `Section`, `Columns`, `SplitPane`, `PageHeader` |
| Shell | Product-level frame around a route/workspace and its navigation | `apps/web` | app shell, auth shell, adapter workspace shell |
| Adapter composite | Named reusable composition of adapter primitives, defined using the same component mechanism as other named components | adapter package | DuckDB data explorer, Snowflake session bar |
| Adapter custom component | Provider-specific browser view with a real product interaction or visual model that is not a generally reusable primitive | adapter + renderer registry | DuckDB query workbench, extension catalog/detail |
| Wire component | Browser-safe serialized representation of a declarative component | `packages/core` | the page-document component envelope |

“Primitive” means reusable across adapters, not merely small. “Custom” means
provider-specific behavior or presentation, not merely a component with many
props.

## Target direction

### 1. One component authoring convention

Use `defineComponent` as the visible declaration convention for both default
adapter components and adapter-owned components. The implementation may have
different renderers behind the definition, but adapter authors should not need
to hand-build one-off `{ kind, props }` objects or learn a separate constructor
pattern for standard components.

The proposed shape is:

```ts
export const Table = defineComponent({
  id: "dsui/table",
  // declarative props/serialization metadata owned by the SDK
});

export const DuckDbQueryEditor = defineComponent({
  id: "duckdb/query-editor",
  path: "./components/query-editor.tsx",
  props: queryWorkbenchProps,
});
```

The exact overloads and whether the built-in definition uses `render`, a
first-party renderer registration, or a dedicated internal definition form is
an implementation decision for the first contract ADR. The important invariant
is one public authoring convention and one discoverable registry path.

Do not solve the current type repetition by making the public SDK boundary
`any`. It is acceptable to use a generic internal component envelope or a
deliberately loose registry implementation, but each supported component must
still have an explicit props contract, serialization rule, runtime validation
where data is untrusted, and renderer behavior.

### 2. A generic component envelope at the page boundary

Replace the large collection of hard-coded wire-node variants incrementally with
a single component envelope as the long-term direction:

```ts
type PageComponent = {
  kind: "component";
  component: string;
  props?: Record<string, unknown>;
};
```

Nested content is still represented by component props. Resource and action
bindings are serialized into browser-safe references before the envelope crosses
the server boundary. The registry resolves `component` IDs to first-party or
adapter-provided views.

This does not mean arbitrary adapter data becomes executable browser code. The
host continues to allowlist/validate the serialized document, and custom
components receive JSON-serializable props only. The old node variants should
remain during a compatibility window until all consumers and tests have moved.

The first implementation may retain typed aliases for the supported component
definitions so adapter authors get useful editor help. The wire shape should be
simple even if authoring types remain richer.

### 3. Explicit primitive/layout/custom tiers

The initial classification for review is:

| Keep as shared adapter primitive/layout | Review as adapter-specific/custom |
| --- | --- |
| `PageHeader` | DuckDB `QueryEditor` |
| `Button` | DuckDB extension catalog/detail workflow |
| `Table` | DuckDB extension cards/details if they depend on extension semantics |
| `KeyValue` | DuckDB data explorer composition (as a named adapter composite) |
| `Tabs` | DuckDB database/table/relation page compositions |
| `Section` | DuckDB admin/configuration workflow |
| `Columns` | DuckDB-specific query history presentation |
| `SplitPane` | Provider-specific entity actions and detail panels |
| `ResourceTree` | Any view whose props encode DuckDB-only fields or operations |
| `StatGrid`, `CardList`, `ActionList`, `Meter` |  |
| `Form`, `TextInput`, `Select`, `CodeEditor` |  |

`EntityCatalog` and `EntityDetail` should not remain generic merely because
their names sound reusable. First move them behind DuckDB-owned definitions and
promote a smaller generic catalog primitive only if a second adapter needs the
same contract without provider-specific branching. The same test applies to
`QueryEditor`: a generic SQL editor primitive may be useful later, but the
DuckDB query workflow should not force a universal workbench contract now.

### 4. Web product structure

Reshape `apps/web/src` around ownership and user-facing capability, not around a
single `screens.tsx` file:

```text
apps/web/src/
  app/
    router.tsx
    app-shell.tsx
    providers.tsx                 # only if a provider is needed
  shells/
    app-chrome.tsx
    auth-shell.tsx
    workspace-shell.tsx
    adapter-shell.tsx
  layouts/
    page.tsx
    page-heading.tsx
    split-view.tsx
    content-grid.tsx
  features/
    dashboard/
    connections/
    adapters/
    settings/
    adapter-workspace/
    query-editor/                 # only legacy/product-owned web workflow
  components/
    icon.tsx
    service-mark.tsx
    states.tsx
  lib/
    api/
    navigation/
    formatting/
```

The exact names can change during implementation, but every file must have one
obvious home. Product shells/layouts must not be duplicated inside a feature.
Feature components must not become a second design-system package. Shared visual
pieces belong in `packages/ui`; adapter page views belong in `packages/renderer`.

`screens.tsx` should be reduced to route-level composition or removed after the
last screen has moved. The move is mechanical first; visual redesign is out of
scope.

### 5. Renderer structure

Make renderer ownership visible in the filesystem and registration code:

```text
packages/renderer/src/
  components/
    primitives/                  # page-header, table, form, inputs, etc.
    layouts/                     # section, columns, split-pane, tabs
    data/                        # table, key-value, cards, meter, tree
    custom/                      # custom envelope and adapter view host
  registry/
    definitions.ts
    registry.ts
  page-renderer.tsx
  resource-hooks.ts
  entity/                        # only if entity views remain generic
```

This is a target ownership model, not a requirement to move files in one large
rename. The first renderer PR should remove side-effect registration where
possible and make the first-party registry table the single place to discover
which component IDs exist.

## Phased implementation plan

Each phase is intended to be a separate reviewable PR or a tightly related pair
of PRs. No phase should change behavior and public contract shape at the same
time unless the contract ADR explicitly approves that coupling.

### Phase 0: Inventory and contract decision

#### Task 0.1: Freeze the vocabulary and ownership matrix

Document every current SDK component, page-node kind, renderer view, web shell,
and DuckDB composite in one matrix. For each item record owner, consumers,
whether it is a layout/primitive/custom component, and the proposed destination.

Acceptance criteria:

- [ ] Every current `packages/adapter-sdk/src/components` export is classified.
- [ ] Every `packages/core` page-node kind has a proposed compatibility path.
- [ ] Every renderer view and every major `apps/web/src/screens.tsx` section has
      an owner and destination.
- [ ] DuckDB-specific behavior is called out explicitly rather than inferred
      from file location.

Verification: a reviewer can trace any current component from adapter source to
wire representation to renderer view without opening an implementation file.

Dependencies: none.  
Likely files: this plan, a temporary inventory table or review notes.  
Scope: Medium.

#### Task 0.2: Write the component-envelope ADR

Decide whether the long-term wire contract is one generic component envelope,
which parts remain statically typed, how nested nodes are represented, how
resource/action bindings are encoded, how unknown component IDs fail, and how
old node kinds are versioned or deprecated.

Acceptance criteria:

- [ ] The ADR names the SDK, core, renderer, host/server, adapter, and web
      consumers.
- [ ] It defines validation and trust-boundary behavior for props and bindings.
- [ ] It includes a migration example from one current DuckDB page.
- [ ] It explicitly rejects browser code, credentials, closures, and arbitrary
      executable adapter payloads crossing the boundary.

Verification: Claude and a human maintainer can review the contract without
needing to infer behavior from the implementation.

Dependencies: Task 0.1.  
Likely files: `docs/engineering/decisions/NNNN-component-envelope.md`.  
Scope: Medium.

#### Task 0.3: Produce the initial simplification report

Apply the Codebase Simplifier method to the SDK component model, renderer
registry, DuckDB page composition, and `apps/web/src/screens.tsx`. This report
must distinguish real package/trust boundaries from forwarding layers and must
identify deletions or consolidations that should precede any new abstraction.

Acceptance criteria:

- [ ] The report includes an architecture summary and dependency map.
- [ ] It identifies dead code, duplicate abstractions, premature abstractions,
      excessive indirection, fragmentation, dependency complexity, and API
      complexity where present.
- [ ] Each proposal is classified P0, P1, P2, or P3 with behavioral risk and
      blast radius.
- [ ] P2/P3 proposals are clearly separated from work approved for incremental
      implementation.

Verification: Claude review and human maintainer review confirm that the plan
reduces concepts rather than merely moving files or adding registries.

Dependencies: Task 0.1.  
Likely files: `tasks/ui-sdk-cleanup-plan.md` or a linked review artifact.  
Scope: Medium.

### Checkpoint: Contract approval

- [ ] Inventory is complete.
- [ ] Component-envelope ADR is accepted or the migration is blocked pending a
      decision.
- [ ] Simplification report is reviewed; P0/P1 work is separated from P2/P3
      proposals.
- [ ] No implementation PR starts the wire migration before this checkpoint.

### Phase 1: Establish the new definitions without changing behavior

#### Task 1.1: Create the SDK component-definition foundation

Introduce the internal/public definition model that can describe a default
adapter primitive, a layout, a composite, or a browser custom component. Keep
the existing constructors as compatibility wrappers initially.

Acceptance criteria:

- [ ] Built-in and adapter-owned components have one visible definition shape.
- [ ] Definitions carry a stable ID and an explicit ownership/category field or
      an equivalent registry metadata record.
- [ ] The registry implementation can remain loose internally, but supported
      definitions expose a clear props contract and serialization behavior.
- [ ] Existing SDK exports and current serialized output remain unchanged.
- [ ] The change does not add a wrapper or registry layer where deletion or
      consolidation would solve the same problem more directly.

Verification: SDK unit tests, public-export tests, typecheck, and serialization
golden tests pass; add invalid definition tests for missing IDs and conflicting
render modes.

Dependencies: Task 0.2.  
Likely files: `packages/adapter-sdk/src/components/*`,
`packages/adapter-sdk/src/index.ts`, tests.  
Scope: Medium.

#### Task 1.2: Build a first-party component registry table

Replace implicit renderer discovery with one explicit table that maps component
IDs to first-party views, prop validation, nested-content handling, and lazy
loading policy. Keep registry mechanics private until the adapter extension
contract is stable.

Acceptance criteria:

- [ ] A reader can find all first-party component IDs in one registry module.
- [ ] Unknown IDs render an explicit, accessible error state.
- [ ] Registry resolution is tested for sync, lazy, unknown, and duplicate IDs.
- [ ] Side-effect imports are removed or isolated behind one documented entry
      point.
- [ ] The registry is justified as a real boundary; it is not added solely to
      hide duplicated component definitions.

Verification: renderer unit tests and a rendered unknown-component test pass;
renderer typecheck passes.

Dependencies: Task 1.1.  
Likely files: `packages/renderer/src/registry*`, `page-node-renderer.tsx`,
renderer tests.  
Scope: Medium.

#### Task 1.3: Separate renderer primitives, layouts, and custom hosting

Move or rename renderer files only as needed to make the three tiers obvious.
Do not redesign the UI. Keep generic entity code together only if the contract
is genuinely generic; otherwise mark it as temporary compatibility code for
Phase 2.

Acceptance criteria:

- [ ] File and export names communicate whether a view is a primitive, layout,
      data view, or custom host.
- [ ] `packages/renderer` does not expose DuckDB-specific names.
- [ ] Existing page rendering behavior and accessibility behavior are retained.

Verification: renderer tests, app typecheck/build, and manual smoke render of a
DuckDB overview, data, query, and extension page.

Dependencies: Task 1.2.  
Likely files: `packages/renderer/src/**`.  
Scope: Medium.

### Checkpoint: Foundation behavior

- [ ] Existing page documents render unchanged.
- [ ] First-party registry has one discoverable registration path.
- [ ] No adapter or web feature has been migrated yet.

### Phase 2: Migrate DuckDB as the reference adapter

#### Task 2.1: Convert shared DuckDB page composition to the new definitions

Migrate overview, data, database, schema, relation, files, admin, and activity
pages to the new default component convention while retaining their current
observable output.

Acceptance criteria:

- [ ] Pages read as compositions of shared primitives/layouts.
- [ ] `dataExplorer` remains an adapter-owned composite built from
      `ResourceTree`; it does not become a renderer special case.
- [ ] Resource and action bindings serialize identically or have an explicit
      reviewed compatibility change.
- [ ] No DuckDB page hand-builds a page-node object.

Verification: adapter tests, SDK serialization tests, adapter typecheck, and
manual smoke checks for all DuckDB page paths.

Dependencies: Phase 1 checkpoint.  
Likely files: `packages/adapter-duckdb/src/pages/**`,
`packages/adapter-duckdb/src/components/data-explorer.ts`.  
Scope: Large; split by overview/data/admin if necessary.

#### Task 2.2: Move DuckDB-specific entity views out of the generic SDK

Move extension catalog/detail definitions and their browser views behind
DuckDB-owned component IDs. Keep only a genuinely provider-neutral entity
contract in shared packages, if one is still justified after the move.

Acceptance criteria:

- [ ] Generic SDK exports no longer imply that DuckDB extension management is a
      universal primitive.
- [ ] DuckDB extension pages use namespaced IDs such as
      `duckdb/extension-catalog` and `duckdb/extension-detail`.
- [ ] The browser receives only JSON-serializable, validated props and declared
      resource/action references.
- [ ] Existing extension list/detail interactions remain functional.

Verification: adapter tests, renderer custom-component tests, extension page
browser/manual checks, and package boundary/typecheck checks.

Dependencies: Task 2.1 and the component-envelope ADR.  
Likely files: `packages/adapter-sdk/src/components/entities.ts`,
`packages/renderer/src/EntityViews.tsx`, `packages/renderer/src/EntityPrimitives.tsx`,
DuckDB extension pages/resources, registry entries, tests.  
Scope: Large; split catalog and detail into separate PRs.

#### Task 2.3: Decide and migrate the DuckDB query workbench

Treat the current query workbench as DuckDB product workflow first. Extract only
provider-neutral pieces (for example SQL tokenization or a generic editor host)
when their API is independently useful. Do not force query-specific behavior
into every adapter’s primitive vocabulary.

Acceptance criteria:

- [ ] The component ID and owner clearly identify whether the workbench is
      generic or DuckDB-specific.
- [ ] Query execution, cancellation, result rendering, explorer selection, and
      loading/error states have an explicit owner.
- [ ] The generic renderer does not branch on DuckDB operation names or result
      positions.
- [ ] Existing query tests continue to establish the observable behavior.

Verification: renderer query tests, DuckDB adapter tests, app/browser smoke
test, and a manual check of cancellation and malformed-result behavior.

Dependencies: Task 2.2 and the component-envelope ADR.  
Likely files: `packages/renderer/src/components/query-workbench/**`,
DuckDB query page/actions/resources, `apps/web` legacy query path if still used.
Scope: Large; split protocol extraction from visual migration.

### Checkpoint: DuckDB reference adapter

- [ ] DuckDB pages use the standard component-definition convention.
- [ ] DuckDB-specific components are namespaced and owned by the adapter.
- [ ] Shared renderer code contains no DuckDB-specific branches.
- [ ] A second adapter has not been migrated until the conventions survive this
      pilot review.

### Phase 3: Migrate the web product structure

#### Task 3.1: Extract route composition from `screens.tsx`

Split the monolithic screen module by product surface while preserving routes,
loaders, API calls, and UI behavior. Keep the first pass mechanical; do not
combine it with a visual redesign.

Acceptance criteria:

- [ ] Routing composition lives under `apps/web/src/app` or an equivalent
      route-owned location.
- [ ] Shells are separate from feature screens.
- [ ] Dashboard, connections, settings, auth, and adapter workspace each have
      an obvious feature directory.
- [ ] No feature imports another feature’s implementation file to obtain a
      shared visual component.

Verification: web typecheck, unit tests, connection browser tests, build, and
route smoke checks for auth, dashboard, services, adapter pages, and settings.

Dependencies: Phase 2 checkpoint is preferred; can begin after Phase 1 if
contract work is independent.  
Likely files: `apps/web/src/screens.tsx`, `router.tsx`, new `app/`, `shells/`,
`features/`, and existing component files.  
Scope: Large; split by route surface.

#### Task 3.2: Establish product shell and layout conventions

Name and extract the app shell, auth shell, adapter workspace shell, page
heading, page container, split-view, and common empty/error/loading states.
Keep adapter declarative page layouts in `packages/renderer`; these web layouts
are only for the dsui product chrome and non-adapter screens.

Acceptance criteria:

- [ ] Shells own navigation, route outlet placement, and global product chrome.
- [ ] Layouts own spacing and responsive structure, not data fetching.
- [ ] Feature components own workflow state and API orchestration.
- [ ] Shared UI primitives continue to come from `packages/ui`.
- [ ] CSS ownership is clear: global tokens in `packages/ui`, product shell CSS
      in `apps/web`, feature-specific CSS co-located or explicitly grouped.

Verification: responsive/manual checks at existing desktop and mobile coverage,
connection browser tests, reduced-motion checks for shell transitions, and web
build.

Dependencies: Task 3.1.  
Likely files: `apps/web/src/components/**`, `workspace.css`,
`connections.css`, new shell/layout/feature files.  
Scope: Large; split shell extraction from CSS consolidation.

#### Task 3.3: Remove duplicate legacy adapter rendering paths

After the declarative renderer covers the supported page workflows, remove or
quarantine old `apps/web` renderer branches that rely on operation names,
positional rows, or provider-specific assumptions. Preserve an explicit
compatibility path only where a documented adapter still requires it.

Acceptance criteria:

- [ ] The supported adapter page path has one primary rendering model.
- [ ] Any retained legacy path has a named owner, compatibility reason, and
      removal condition.
- [ ] Generic web code does not inspect DuckDB operation names or result shapes.
- [ ] The architecture documentation no longer describes retired paths as
      current.
- [ ] Obsolete compatibility code is deleted when its last consumer is removed;
      retained compatibility code has an owner and removal condition.

Verification: web tests, adapter integration tests, build, and a grep-based
review for retired assumptions.

Dependencies: Tasks 2.1–2.3 and 3.1.  
Likely files: `apps/web/src/screens.tsx`, `api.ts`, feature modules,
`docs/engineering/architecture.md`.  
Scope: Medium to Large.

### Checkpoint: Product structure

- [ ] `screens.tsx` is gone or only a thin route composition module.
- [ ] Product shells/layouts and adapter renderer layouts are not duplicated.
- [ ] The web app has one documented location for feature code and one for
      shared UI imports.
- [ ] Visual behavior is unchanged unless a separate UI review approved it.

### Phase 4: Compatibility cleanup and documentation

#### Task 4.1: Deprecate duplicate constructors and old node variants

Only after the pilot and a second consumer confirm the new convention, add
deprecation guidance and remove redundant constructors/types in a separate PR.
Do not delete public exports as part of the initial reorganization.

Acceptance criteria:

- [ ] Every removed or changed export has a migration example and release note.
- [ ] Old page-node variants have a documented compatibility window or an
      explicit breaking-change decision.
- [ ] SDK public-export, type, serialization, adapter, and renderer tests cover
      both the migration path and rejected invalid input.

Verification: full root checks, affected adapter checks, build, package export
review, and documentation link check.

Dependencies: all prior checkpoints plus a maintainer compatibility decision.
Likely files: SDK/core docs and exports, release notes, tests.  
Scope: Medium.

#### Task 4.2: Publish the conventions for adapter authors

Rewrite the SDK component guide around the primitive/layout/composite/custom
taxonomy. Include a complete DuckDB example and one small generic adapter
example, plus rules for when not to create a custom component.

Acceptance criteria:

- [ ] The guide explains the one definition convention and component IDs.
- [ ] It explains resource/action binding serialization and browser trust
      boundaries.
- [ ] It shows a layout composition and an adapter-specific custom component.
- [ ] It does not promise genericity for DuckDB-only features.

Verification: docs link check, SDK docs build if available, and review by a
maintainer who did not write the implementation.

Dependencies: Tasks 2.2, 2.3, and 4.1.  
Likely files: `packages/adapter-sdk/docs/guides/components.md`, reference docs,
architecture/decision records.  
Scope: Medium.

## Compatibility and rollout rules

- Keep each PR functional and focused. Do not combine the component-envelope
  migration with a visual redesign or new provider capability.
- Preserve existing exports until a reviewed deprecation/migration PR. The SDK is
  experimental, but its public surface still requires an explicit compatibility
  decision.
- Run affected SDK, renderer, DuckDB adapter, and web tests after each vertical
  slice; run root checks before handoff.
- Add or update a decision record when changing the SDK/core wire contract,
  package ownership, renderer extension contract, or browser trust boundary.
- Keep a compatibility adapter for old page nodes only as long as a real consumer
  needs it. Do not leave a permanent dual architecture without an owner and
  removal acceptance criteria.
- Do not use a generic `Record<string, unknown>` wire envelope to skip validation.
  The envelope may be generic; each component definition still owns validation,
  nested-node handling, binding serialization, and rendering.
- Apply the Codebase Simplifier priority order to every PR: delete P0 first,
  consolidate P1 next, and do not implement P2/P3 without an explicit review
  decision. Do not add a new layer merely because the current layout is messy.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A generic envelope hides useful props types | High | Keep typed authoring definitions and per-component validators/codecs; make only the internal registry/wire envelope generic. |
| Entity catalog or query workbench is generalized too early | High | Start with DuckDB-owned IDs; promote only after a second adapter demonstrates the same contract. |
| SDK/core/renderer/server versions drift during migration | High | Use an ADR, compatibility fixtures, serialized-document tests, and staged deprecation. |
| Side-effect registration becomes an opaque plugin mechanism | Medium | Keep one explicit first-party registry table and test duplicate/unknown IDs. |
| Moving web files changes behavior or accessibility | Medium | Mechanical extraction first; preserve browser tests, keyboard/focus behavior, responsive checks, and reduced motion. |
| Existing legacy and declarative paths diverge | High | Inventory every route and define one owner/removal condition before deleting code. |
| Cleanup becomes a universal UI rewrite | Medium | Keep the pilot to DuckDB and product shells; require a separate proposal for new capabilities or visual redesign. |
| Public exports are deleted during refactoring | High | No silent deletion; use deprecation and migration PRs after the pilot. |
| Cleanup adds a new abstraction layer instead of simplifying the system | High | Require the simplification report, prefer deletion/consolidation, and review every new registry, wrapper, factory, or generic type against the four abstraction questions. |

## Decisions needed from reviewers

1. Should the long-term browser-safe contract be exactly one generic component
   envelope, or should a small set of protocol-level categories remain as
   discriminated variants for validation and tooling?
2. Should first-party components use `defineComponent` directly, or should the
   SDK expose a private `defineBuiltinComponent` implemented by the same
   underlying mechanism while keeping adapter-facing APIs identical?
3. Is `CodeEditor` a generic adapter primitive, or should it become a renderer
   capability used only by a future query/editor component?
4. Should entity catalog/detail remain a shared generic contract after DuckDB is
   moved behind namespaced IDs, or should the first version keep them entirely
   adapter-owned?
5. Which compatibility window is acceptable for old page-node kinds and SDK
   exports: one release, two releases, or until the next pre-1.0 boundary?
6. Does `packages/renderer` remain the correct package name/ownership, or should
   the long-term split distinguish protocol rendering from product-specific
   browser components more explicitly?

## Review checklist

- [ ] Claude review identifies missing consumers, contract risks, or overly broad
      abstractions.
- [ ] Claude review evaluates the simplification report and challenges any new
      layer that does not remove concepts.
- [ ] Human maintainer accepts the ownership matrix and compatibility policy.
- [ ] The component-envelope ADR is accepted before implementation.
- [ ] DuckDB is approved as the pilot and no second adapter is migrated in the
      same first PR.
- [ ] Every implementation PR names its affected packages, tests, and rollback
      path.
