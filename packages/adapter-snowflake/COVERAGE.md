# Snowflake adapter coverage

This file tracks how much of the Snowflake coverage map the current SDK
can express, with no SDK changes. Checked items live in
`packages/adapter-snowflake/src/` and are proven by
`test/adapter.test.ts` against the fake client, with production SQL in
`sql-client.ts`.

Legend: `[x]` covered. `[~]` partial. `[ ]` listed gap, meaning it needs
an SDK primitive or a renderer capability. Gaps are listed, not worked
around.

## 1. Session context

- [x] Active role, warehouse, database, schema. The adapter-scoped
  `sessionStore` holds them with typed setters.
- [x] Secondary roles. `session.secondaryRoles` state plus setter.
- [x] Context display. `QueryContextBar` on the query editor page.
- [x] Context editing. Text inputs on `/query` bind store state and
  actions for role, warehouse, database, and schema.
- [~] `SessionBar`, the Select-based composite, exists as the canonical
  component. Its option lists still need renderer support to populate
  from the `roles`, `warehouses`, and `databases` resources.
- [ ] `changeRole` and similar `defineAction`s. Skipped on purpose:
  store actions already do this, so separate actions would add nothing.

## 2. Projects and development

- [x] SQL editor (`CodeEditor`), execute (`runQuery`), cancel
  (`cancelQuery`). The Cancel button appears only while a query id is
  tracked. Results render through the `queryResults` resource in a
  table, and rows link to query detail pages.
- [~] Current execution status. Polling `queries` plus the tracked
  `currentQueryId` shows it, but there are no live per-execution
  progress states.
- [ ] Multiple workspace files, autocomplete, syntax highlighting.
  These belong to the `CodeEditor` renderer.
- [ ] Export results. The SDK has no download primitive.
- [ ] Notebooks, Streamlit, Dashboards, Native Apps. These need cell,
  notebook, embed, chart, and app-hosting primitives.

## 3. Catalog and database explorer

- [x] Database list and details (`databases`, `databaseDetails`).
- [x] Schema list, plus an explorer with tabs for Tables, Views,
  Stages, Streams, Dynamic Tables, Sequences, Materialized, and Formats.
- [x] Table pages with Overview, Columns (`tableColumns`), Data preview,
  Details, DDL (`tableDdl`), and Loads (table-scoped `copyHistory`).
- [x] View list and detail, with the SQL definition read through
  `GET_DDL`.
- [x] Stages with file listing (`LIST @stage`), streams, dynamic
  tables with suspend and resume, and sequence, materialized view,
  and file format lists.
- [x] Function and procedure lists, plus procedure execution through
  a form and the `executeProcedure` action.
- [ ] Constraints, keys, per-object privileges, dependencies, lineage.
  Privilege data exists globally through `grants`, but attaching it
  per object and drawing lineage need Graph and permission-matrix
  components.
- [ ] Clone, rename, drop, and alter actions beyond warehouses, tasks,
  pipes, dynamic tables, and monitors. The action pattern fits all of
  them. Destructive ones wait for the confirmation gap in section 17.
- [ ] Iceberg, external, and hybrid tables, semantic views, policies,
  search optimization. Same list and detail pattern, not wired yet.

## 4. Compute

- [x] Warehouse list on a 5 second poll, warehouse detail
  (`warehouseDetails` plus warehouse-filtered queries), and
  suspend, resume, resize, create, and drop with invalidation.
  Row-level actions adapt to each warehouse status.
- [x] Compute pool list with suspend and resume on `/compute-pools`,
  polled every 30 seconds.
- [ ] Load and credit charts, queuing timelines. These need chart
  components.

## 5. Monitoring

- [x] Query history with warehouse, status, and search filters on a
  10 second poll, reactive to `queryFiltersStore`. Detail pages have
  Details and Results tabs, and running queries can be cancelled.
- [~] Extended filters (user, time range, statement type, duration,
  session, tag, query hash). Free-text search covers part of this.
  Dedicated filter fields are follow-up work, with no SDK gap.
- [x] Task list, detail, run, suspend, and resume, plus run history
  (`taskHistory` on a 10 second poll). Dependencies ship as
  `predecessors` data.
- [x] Log viewer with search and level filters on a 10 second poll,
  backed by the page-scoped `logFiltersStore`.
- [ ] Live log streaming. This needs a `stream(...)` resource primitive.
- [ ] Task and DAG graph drawing, query profile operator trees. The
  data contracts exist (`taskDetails.predecessors`), but there is no
  Graph or Tree component.
- [ ] Grouped query history (p50, p90, p99, executions per minute).
  This needs aggregation plus charts.
- [ ] Container services, traces. Same list and detail pattern, not
  wired.

## 6. Transformation

- [x] Tasks (section 5), dynamic tables (section 3), procedure
  execution (section 3).
- [ ] dbt projects. Same list, detail, and log pattern, not wired.

## 7. Ingestion

- [x] Stages with files, copy history, Snowpipe pipes with pause and
  resume, streams.
- [ ] Add-data wizard (multi-step upload flow), connectors, Openflow,
  migrations. These need wizard and modal primitives.

## 8. Governance and security

- [x] User list, detail, create, suspend, and resume. Role list.
  Grant list with grant and revoke forms, all with invalidation.
- [x] Access history on `/access-history` with a 60 second poll.
- [ ] Database roles, network, tag, masking, row-access, and session
  policies. Same CRUD pattern, not wired.
- [ ] Trust Center, Data Quality. These need findings and incident
  models.

## 9 and 10. Sharing and Marketplace

- [ ] Shares, listings, provider studio, marketplace install. The
  list, detail, and action pattern fits, but none of it is wired.

## 11. Catalog (universal search, lineage)

- [ ] Needs a search component plus a lineage graph.

## 12. AI and ML

- [ ] Needs chat and streaming-text components.

## 13. Cost management

- [x] Warehouse spend, budgets, and resource monitors with suspend,
  resume, and invalidation on `/cost`.
- [ ] Forecasting, cost-by-tag charts. These need chart components.

## 14. Account and admin

- [x] Account details on `/account`, plus resource monitors from
  section 13.
- [ ] Parameters, contacts, Partner Connect. Same pattern, not wired.

## 15. Cross-cutting UI

- [x] Static, single, multi, and deep dynamic routes, including the
  nested `/tasks/:database/:schema/:task`. Page headers, tabs, tables
  with row actions and deep links, key-value details, forms with
  Zod-shared schemas, and store-bound text, select, and code inputs.
- [ ] Table sorting, filtering, pagination, infinite scroll, column
  selection, multi-select, export. `Table` has no props for these.
- [ ] Modal forms, confirmations (drop and revoke need these), toasts.
  No primitives exist. Destructive actions are defined but not all of
  them have UI wired up.
- [ ] Breadcrumbs, nested sidebar, back navigation, global search.
  These belong to the renderer.
- [ ] Charts, time series, DAGs, lineage, profile trees, metrics,
  progress. No components exist, though data contracts are ready
  where noted above.
- [ ] Number, boolean, combobox, multi-select, and code inputs,
  dynamic fields, validation display. Form field gaps.
- [ ] Loading, refreshing, error, and empty states. The runtime
  tracks these states. Showing them automatically is renderer work.

## 16. Delivery modes

- [x] Manual reads (`tableDetails`, `accountDetails`, and similar)
  and polling at 5, 10, 30, and 60 seconds per resource.
- [ ] Streaming. No primitive exists. Poll-based logs are the
  interim shape.

## 17. Action types

- [x] Immediate actions (store actions), mutation plus invalidation,
  long-running shape (`runQuery`, `runTask`, `executeProcedure`),
  cancellable actions (`cancelQuery` plus the `signal` option), and
  form-driven actions.
- [ ] Confirmation-based actions. No confirm primitive exists.
  `dropWarehouse`, `revokePrivilege`, and similar are defined, but
  their destructive buttons are deliberately not all wired to UI.

## 18 and 19. Stores and routing

- [x] Adapter scope (session) and page scope (query, editor, and log
  filters) with isolation, subscription, reset, and disposal. All of
  it tested.
- [ ] Query params (`/queries?status=…`), URL-backed stores. No
  primitives exist.

## 20. What the adapter proves about the SDK

Covered: simple and complex list and detail pages, dynamic and deeply
nested routing, parameterized and reactive resources, polling, manual
loading, invalidation (including input-scoped), adapter and page
state, forms, immediate, mutation, long-running, and cancellable
actions, data-driven UI, code editors, multiple isolated instances,
and custom composites through `defineComponent`.

Not proven (SDK gaps, in priority order): streaming resources, table
power features (sort, filter, paginate), confirmation and modal
primitives, Graph and Tree components, charts, linking action results
back into stores (for example capturing the new `queryId` after Run),
URL query params and URL-backed stores, download and export, and
toast and feedback primitives.

## 21. Priority status

- P0 reference coverage: done, except streaming logs (poll interim)
  and graph and profile drawing (data ready, components missing).
- P1: done (users and roles, grants, dynamic tables, copy history,
  stages, streams, procedures and functions, cost, monitors).
- P2 and P3: listed above. No SDK blockers beyond section 20.
  They need renderer components (charts, graphs, chat, wizards),
  not new SDK concepts.
