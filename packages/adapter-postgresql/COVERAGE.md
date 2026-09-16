# PostgreSQL adapter coverage

This ledger describes the current adapter surface and the limits that are
intentional while the SDK and renderer remain generic.

## Covered

- Structured PostgreSQL connection configuration.
- Configurable database visibility: all visible databases or the bootstrap database only.
- Per-instance client creation and disposal.
- SSL modes and optional CA/client certificate fields.
- Server information and PostgreSQL version reporting.
- Capability resource for activity, database listing, and query cancellation.
- Database listing from the configured connection.
- Schema, relation, column, index, and constraint catalog resources.
- Lazy per-database clients with database-scoped catalog pages.
- Bounded relation preview resource.
- Read-only catalog pages built from SDK components.
- Page-scoped SQL editor state.
- Bounded ad-hoc query action with statement timeout and serializable results.
- Query cancellation through `pg_cancel_backend` when the connection has permission.
- Create/drop schema actions with SDK confirmation UI.
- Read-only activity resource with SDK-managed five-second polling.
- Generic service, resource, and action execution routes.

## Partial

- Database clients are created lazily when a database detail page is opened.
  A large database list therefore does not create one pool per database up front.
- Query cancellation depends on the PostgreSQL role having execute permission
  for `pg_cancel_backend`; the capability resource exposes that state.
- Query results are bounded to 10,000 rows and 16 MiB after execution. The
  driver still receives the provider result before the adapter applies these
  response bounds.
- The adapter reports server version but does not yet gate features through a
  capability resource.

## Not implemented

- Query history beyond the live `pg_stat_activity` view.
- DDL actions for relations, views, and indexes.
- Query result persistence or streaming.
- PostgreSQL-specific backend routes.
- Custom React components, markup, CSS, polling, or global caches.
