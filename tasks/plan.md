# Implementation Plan: ClickHouse Workspace Milestone 1

## Overview

Build a shared workspace shell and a comprehensive ClickHouse schema explorer,
starting with the smallest complete database-to-table-detail path and expanding
it tab by tab. Keep legacy adapters and URLs working.

## Architecture Decisions

- Add optional navigation metadata to the core capability view; omission keeps
  the current flat UI.
- Keep browser renderers generic. ClickHouse owns SQL and declarations only.
- Encode selected database/table/tab in URL state.
- Use lazy bounded operations instead of loading the complete catalog eagerly.
- Implement realistic ClickHouse behavior in the existing adapter emulator.

## Task List

### Phase 1: Foundation

- [x] Task 1: Add and transport the optional workspace navigation contract.
- [x] Task 2: Render top-level workspace areas with legacy flat-nav fallback.

### Checkpoint: Shell

- [x] Contract, server, and web tests pass.
- [x] Existing service routes remain represented by the router and typecheck.

### Phase 2: Explorer

- [x] Task 3: Add lazy database/object explorer operations and tree UI.
- [x] Task 4: Add table Overview and Columns tabs.
- [x] Task 5: Add bounded Data preview and DDL tabs.
- [x] Task 6: Add bounded Parts tab.
- [x] Task 7: Add realistic ClickHouse mock fixtures for the whole flow.

### Checkpoint: Explorer

- [ ] Database → table → every detail tab works end to end.
- [ ] Direct URLs and browser back/forward work.
- [ ] Empty, loading, error, keyboard, and responsive states are verified.

### Phase 3: Polish and Gate

- [ ] Task 8: Browser QA and accessibility polish.
- [x] Task 9: Review final architecture, security, and performance.

### Checkpoint: Complete

- [ ] Focused and full tests pass.
- [ ] Lint, typecheck, and build pass.
- [ ] Milestone acceptance criteria are met.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Shared contract breaks existing adapters | High | Optional additive metadata and legacy fallback tests |
| Large catalogs overload the browser | High | Lazy object loading, search, row caps, and pagination |
| Identifier injection | High | Zod boundaries and ClickHouse `Identifier` parameters |
| Generic UI gains ClickHouse branches | Medium | Capability-driven renderers and contract tests |
| Existing large `screens.tsx` becomes worse | Medium | Extract focused workspace/explorer components |

## Open Questions

None for milestone 1.
