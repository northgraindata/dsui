# 0002: DuckDB adapter

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

`packages/adapter-duckdb` covers DuckDB's surface for individual developers,
single-node scale-up, and enterprise use. DuckDB is embedded,
in-process, single-user (no network auth or roles); it reads the local filesystem
directly, can reach remote storage (S3/GCS/HTTPFS) and MotherDuck (`md:`), and loads
native code through extensions. The adapter runs in-process with the server, so
extension loading executes native code inside the server process. The connection
form is built from the adapter's `connectionMethods` (named methods with flat Zod
object schemas), each rendered as a tab or as plain fields when only one exists.

## Decision

Build the adapter on the official `@duckdb/node-api` (DuckDB "Neo", ~1.5.x). The
adapter uses a `DuckDbClient` interface, `duckdb-client.ts`, and a
`duckdb-values.ts` normalizer that maps native DuckDB values (BigInt, Decimal,
BLOB, LIST/STRUCT/MAP) to JSON-safe browser values under nesting and cell-size
caps. `createDuckdbAdapter(createClient?)` permits explicit client construction
where a host needs it.

The connection is declared as three named `connectionMethods` — `memory`, `file`,
and `remote` (httpfs/S3) — each with its own flat Zod object schema; secret fields
are encrypted at rest and redacted from responses and logs.

Security posture is deliberately permissive and documented as accepted risk:
filesystem access relies on OS permissions (no path allowlist), and extension
handling is fully open (`autoInstall`/`autoLoad`/`allowUnsigned` default true).
User-supplied `ATTACH`/`url` values are still validated against scheme/host
allowlists and the server's SSRF guards. MotherDuck (`md:`) is deferred to a
follow-up.

## Alternatives

- **Legacy `duckdb` package**: older callback API, not recommended for new work.
- **Subprocess host for the built-in**: would isolate native extension code but the
  bundled adapters run in-process by design and the loader treats built-ins as local
  packages; rejected for v1.
- **Restrict extensions / path allowlist**: rejected by explicit user decision; the
  risk is recorded here instead of silently permitting it.

## Compatibility and rollout

The adapter uses the flat connection schema above, with `memory` as the in-memory
method. It
consumes the cursor pagination (0003), binary action result (0004), and column
profile (0005) contracts as they land. No new database migrations or publishing.

## Verification

Adapter tests run against a real in-memory `@duckdb/node-api` instance and cover
resources, actions, invalidation, isolation, and page serialization. Value
normalization is unit-tested for BigInt/Decimal/BLOB/nested values and caps.
`bun run test`/`typecheck` in the package, then root checks/build.

## Consequences

DuckDB parity is limited only by shared SDK gaps (notebooks, charts, confirmation
modals), tracked separately. MotherDuck and any extension/path hardening are
follow-ups with explicit owners and acceptance criteria.
