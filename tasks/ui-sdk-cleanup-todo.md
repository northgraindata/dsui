# SDK/UI cleanup task list

This checklist belongs to [`ui-sdk-cleanup-plan.md`](ui-sdk-cleanup-plan.md).
The existing `tasks/plan.md` and `tasks/todo.md` describe a different,
unfinished documentation effort and are intentionally left unchanged.

## Phase 0: Contract and inventory

- [ ] 0.1 Build the component/renderer/web/DuckDB ownership matrix.
- [ ] 0.2 Write and review the component-envelope ADR.
- [ ] 0.3 Produce the Codebase Simplifier report with P0–P3 proposals.

### Checkpoint: Contract approval

- [ ] Inventory is complete.
- [ ] ADR is accepted before wire migration begins.
- [ ] P0/P1 simplification work is separated from P2/P3 redesign proposals.

## Phase 1: Definitions and renderer foundation

- [ ] 1.1 Introduce one component-definition foundation with compatibility wrappers.
- [ ] 1.2 Create an explicit first-party component registry table.
- [ ] 1.3 Separate renderer primitive, layout, and custom-host ownership.
- [ ] Apply the simplifier heuristic before adding each new abstraction.

### Checkpoint: Foundation behavior

- [ ] Existing serialized pages render unchanged.
- [ ] Unknown and duplicate component IDs are covered by tests.

## Phase 2: DuckDB pilot

- [ ] 2.1 Migrate shared DuckDB page composition.
- [ ] 2.2 Move entity catalog/detail behind DuckDB-owned component IDs.
- [ ] 2.3 Decide and migrate the DuckDB query workbench.

### Checkpoint: DuckDB reference adapter

- [ ] DuckDB pages use the standard component-definition convention.
- [ ] Shared renderer code contains no DuckDB-specific branches.

## Phase 3: Web product structure

- [ ] 3.1 Extract route composition from `screens.tsx`.
- [ ] 3.2 Establish shell/layout/feature conventions and CSS ownership.
- [ ] 3.3 Remove or quarantine duplicate legacy adapter rendering paths.

### Checkpoint: Product structure

- [ ] `screens.tsx` is gone or only thin route composition.
- [ ] Product shells/layouts are distinct from adapter renderer layouts.

## Phase 4: Compatibility and docs

- [ ] 4.1 Deprecate duplicate constructors and old node variants in a separate PR.
- [ ] 4.2 Publish the component conventions for adapter authors.

### Checkpoint: Ready for wider adapter migration

- [ ] Full relevant checks pass.
- [ ] Migration guidance is published.
- [ ] A second adapter is approved as the next pilot only after review.
- [ ] Final report lists deleted/merged files, removed abstractions/dependencies,
      tests run, and intentionally preserved complexity.
