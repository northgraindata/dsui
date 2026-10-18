# ClickHouse coverage ledger

This ledger records adapter source coverage and the broader staged plan.
The active UI exposes only Overview, Data, Query and Activity. Operations, Manage
and Notebooks pages are not registered. Standalone management modules and tests remain in the source tree; their actions
are not registered. Notebook implementation and SDK changes are excluded.
Availability depends on ClickHouse deployment, version, server configuration, and grants.

## Implemented

- Structured and URL HTTP(S) connections; Cloud/self-hosted/custom managed endpoints.
- Basic, passwordless/empty password, static JWT, and client-certificate authentication.
- Verified TLS, custom target CA, IPv6, explicit ports, reverse-proxy prefixes/headers.
- Outbound HTTP(S) proxy support, including verified HTTPS CONNECT and client certificates.
- Explicit roles, settings, timeouts, gzip, keep-alive, connection limits, read-only mode.
- Per-service retained contexts, separate control connection, failure cleanup, disposal.
- Authenticated SQL health, sanitized diagnostics, credential-free query signals.
- Database → relation → column explorer; configurable system-database visibility.
- Selected/all database browsing, table/view/materialized-view/dictionary-engine classification.
- Column defaults, aliases/materialized expressions, codecs, comments, key membership.
- Engine/UUID/keys/DDL details, metadata row/byte estimates, bounded preview without FINAL.
- Query editor, typed positional results, duplicate-name handling, CSV result export.
- Single-statement validation, bound resource filters, identifier quoting, bounded response consumption.
- Server-side result/execution limits, late response-error detection, no automatic SQL retries.
- Query-ID cancellation with a separate connection, abort-time best-effort server cancellation.
- SDK-scoped five-second active-query/metrics/merge/fetch refresh.
- Capability probes isolated from connection initialization and required catalog resources.
- Independently failing, column-adaptive system inspections:
  - processes, query_log, query_thread_log, query_views_log;
  - parts, detached_parts, part_log, disks, storage_policies;
  - merges, mutations, replicas, replication_queue, replicated_fetches;
  - clusters, distributed_ddl_queue, distribution_queue;
  - metrics, asynchronous_metrics, events, errors, metric_log, asynchronous_metric_log;
  - settings, server_settings, settings_profiles;
  - users, roles, grants, quotas, row_policies (authentication fields excluded);
  - dictionaries, named collection names, functions, formats, table/database engines, data types;
  - projections, data-skipping indexes, async insert queue/log, backup status.
- Create database from the data explorer.
- Public SDK UI composition throughout; no custom adapter routes/components/styles/polling.

## Partial / deployment-dependent

- Metadata sizes and counts are estimates and can be null or unavailable for some engines.
- Unknown system columns are omitted. Some servers conceal unauthorized tables as absent;
  explicit server permission and missing-table error codes are distinguished where available.
- Inspection is local to the connected endpoint; cluster-wide aggregation is not automatic.
- System inspection resources use enabled server logs, are time-bounded and may lag.
  The standalone Operations UI is not exposed.
- History displays at most 1,000 rows. Catalog resources are bounded to 10,000 rows.
- All-server settings are readable where allowed; editing settings is through SQL.
- Object creation and administration remain accessible through the SQL editor.
- Administration uses configured server grants; server errors enforce permission checks.
  Actions are not all hidden based on preflight privilege probes.
- Standalone management forms are not exposed. There is no durable DSUI job tracker.
- Result streams are bounded on the server process, then sent as one response to the browser.
- Response settings preserve exact large integers/decimals as strings. Nested/JSON values
  use server serialization; every evolving experimental type is not individually certified.
- Static JWT expiry is diagnosed; external token replacement is required.

## Remaining roadmap

- Dedicated Cloud/current-stable, multi-node and cluster-wide compatibility CI.
- Opt-in bounded cluster fan-out with explicit node identity, partial failures, and deduplication.
- Dedicated query-plan visualizer, query/profile events comparison, explicit expensive profiling.
- Rich overview storage/throughput charts, metric aggregation, dependencies and partition summaries.
- Dedicated grant/role/user/quota/profile/row-policy administration and permission-aware action visibility.
- Dedicated dictionary/named collection designers, richer engine-specific editors, cross-database rename.
- Backup/restore destination workflows and restore progress; backup status inspection already exists.
- Streaming file upload/import and large-result downloads across CSV/TSV/JSONEachRow/Parquet,
  column mapping, progress, cancellation, async insert completion, and partial-success reporting.
  The shared SDK/host currently has no general file-transfer protocol; add that infrastructure
  before introducing adapter-specific transfer routes. Existing bounded CSV results can be exported.
- Automatic token refresh/interactive Cloud login, built-in SSH tunnels, native TCP drivers,
  and embedded ClickHouse remain outside the initial transport boundary.
