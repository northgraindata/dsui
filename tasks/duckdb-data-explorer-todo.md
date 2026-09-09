# DuckDB data explorer checklist

## 1. Explorer contract and decision

- [x] Define generic recursive tree data, leaf-link, selected-path, and split-pane contracts.
- [x] Record serialization, ownership, and compatibility decisions.
- [x] Add positive SDK construction and serialization tests.

Verify: SDK tests and typecheck.

## 2. Renderer vertical slice

Depends on task 1.

- [x] Render lazy database → schema → relation expansion.
- [x] Preserve expansion and scroll across detail navigation.
- [x] Support selection, filtering, loading, errors, and empty branches.
- [x] Implement focused-node arrow expansion and responsive panel behavior.

Verify: renderer interaction tests plus browser checks at 320, 768, 1024, and
1440 pixels.

## Checkpoint: shared explorer

- [x] DuckDB pages work without DuckDB-specific renderer code.
- [x] Serialized nodes contain no callbacks or external data rows.
- [ ] Complete roving-focus and screen-reader browser review.

## 3. DuckDB Data integration

Depends on task 2.

- [x] Compose the persistent tree on `/data` and every nested Data route.
- [x] Route table and view leaves to the correct detail state.
- [x] Keep attached databases in the root list.

Verify: adapter route/serialization tests and the file-backed verification fixture.

## 4. Detail-page polish

Depends on task 3.

- [x] Present compact object identity, qualified path, and type.
- [x] Keep table tabs: Overview, Data, Columns, Statistics, DDL.
- [x] Keep view tabs: Overview, Data, Columns, DDL.
- [ ] Add qualified-name copy only through a shared browser behavior.

Verify: page-node tests and browser focus/navigation checks.

## 5. Query explorer reuse

Depends on task 2.

- [x] Replace the workbench-private tree implementation with `ResourceTree`.
- [x] Replace the worksheet with a safely quoted qualified relation after explicit activation.

Verify: renderer tests for insertion position, quoting, and generated SQL examples.

## 6. Freshness and final verification

Depends on tasks 3–5.

- [x] Refresh catalog bindings after successful worksheet SQL.
- [ ] Verify attach/detach invalidates only affected catalog resources.
- [ ] Update DuckDB coverage and SDK docs.
- [ ] Run all focused checks and the repository build.

Verify: create a table in the file-backed fixture and observe it in the open
explorer without restarting DSUI.
