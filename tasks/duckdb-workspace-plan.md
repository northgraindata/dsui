# DuckDB workspace plan

## Objective

Replace the DuckDB adapter's route-list and one-line query form with a compact
developer workspace: Overview, Data, Query, and Administration. A query run must
show its result table and execution facts instead of a generic completion message.

## Architecture decisions

- The browser owns editor text and result presentation. The adapter supplies only
  a declarative query-workbench node and an action reference.
- The renderer uses `modern-monaco`, whose lazy editor path includes Shiki
  highlighting. SQL is the first language and loads on demand.
- Server-owned connection sessions are a separate foundation. Until they land,
  the workbench supports one-shot queries but cannot promise persistence for an
  in-memory database between requests.
- Data navigation collapses into a single explorer after the query-workbench
  slice is stable.

## Task list

1. Query-workbench wire node and renderer
   - Acceptance: a serialized page can declare a SQL editor and action; the
     renderer runs SQL with Cmd/Ctrl+Enter and shows rows, columns, elapsed time,
     affected rows, and errors.
   - Verify: core/SDK serialization tests, renderer interaction test, package
     typechecks and web build.
   - Depends on: none.

2. DuckDB query page migration
   - Acceptance: `/query` renders the workbench, no generic action-completed
     message or one-line SQL input remains.
   - Verify: adapter page serialization test and browser smoke check.
   - Depends on: task 1.

3. Server-owned adapter sessions
   - Acceptance: service-scoped sessions preserve `:memory:` database state and
     query history across page/action/resource requests; disposal is bounded.
   - Verify: server integration tests for create-table then select, cancellation,
     and cleanup.
   - Depends on: task 2; decision 0011 accepted.

4. Data explorer and navigation
   - Acceptance: sidebar contains Overview, Data, Query, Administration; tables
     and databases are navigated through one explorer.
   - Verify: web navigation and keyboard/browser tests.
   - Depends on: task 3.

## Risks

| Risk | Mitigation |
| --- | --- |
| Monaco bundle cost | Use modern-monaco lazy loading and record the production build output. |
| In-memory state loss | Do not claim persistent sessions until task 3 lands. |
| Adapter protocol expansion | Keep the node generic and add wire/renderer tests before adapter migration. |
