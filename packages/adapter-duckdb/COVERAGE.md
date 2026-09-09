# DuckDB adapter coverage

This ledger separates native DuckDB coverage from UI capabilities that DSUI cannot
yet express. Gaps are recorded rather than worked around with adapter-specific
markup or invented data.

Legend: `[x]` covered, `[~]` partial, `[ ]` gap, `[-]` out of scope.

## Catalog and table UX

- [x] Databases, attached databases, schemas, tables, views, columns, previews,
  table statistics, and table/view DDL.
- [x] One Data hierarchy with tables and views in a shared relation list.
- [x] Table pages: Overview, Data, Columns, Statistics, DDL.
- [x] View pages: Overview, Data, Columns, DDL.
- [x] Expandable, searchable database → schema → relation tree with persistent
  expansion, selected-object context, and responsive split-pane navigation.
- [~] Breadcrumbs and copy-qualified-name remain shared-renderer gaps.
- [ ] Preview pagination, sorting, filtering, and column resizing. `Table` cannot
  express these controls yet.
- [ ] Read-only code display. DDL uses `KeyValue` until a serializable code-view
  primitive exists; the store-backed `CodeEditor` cannot cross the page protocol.

## Query

- [x] SQL workbench, result rows, execution metadata, history, and cooperative
  cancellation for work run through DSUI.
- [x] The worksheet reuses the Data explorer and generates safely quoted preview
  SQL when a relation is selected.
- [~] Activity is intentionally named Query History; embedded DuckDB does not
  provide server-wide process monitoring.
- [ ] Action-result to store handoff, query tabs, saved queries, autocomplete,
  selected-SQL execution, prefilled-query navigation, streaming results,
  profiling, and EXPLAIN visualization.

## Files

- [~] CSV, JSON, and Parquet are queryable through SQL.
- [ ] Discoverable configured-file resource and file detail/preview pages. DuckDB
  has no universal file catalog, so `/files` explains the requirement instead of
  presenting synthetic entries.
- [ ] HTTP, S3, Iceberg, and Delta discovery and browsing.

## Extensions and attached databases

- [x] List, detail, install, and load extensions with invalidation.
- [x] List, attach, and detach DuckDB-compatible databases at the action/resource
  layer.
- [~] Detach is not exposed on the detail page because destructive operations need
  a confirmation primitive.
- [ ] PostgreSQL, MySQL, and SQLite-specific attach guidance and capability views.

## Runtime

- [x] Settings and database storage information exist as resources.
- [ ] Dedicated memory, thread, temporary-file, and storage pages.

## SDK limitations

- Breadcrumbs and copy-to-clipboard actions.
- Navigation buttons, including opening the query editor with prefilled SQL.
- Action result to store handoff.
- Rich data-table interactions and read-only code display.
- Query editor tabs and streaming query results.
- Confirmation dialogs for destructive actions.
- Resource-backed filter controls and serializable store callbacks.
- Adapter-provided global-search identities.
