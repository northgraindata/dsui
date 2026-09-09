# 0008: DuckDB connection-method expansion (Quack + per-scheme remotes)

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

The adapter ships three methods (`memory`, `file`, generic `remote`). DuckDB's
actual connection surface is wider, and one part of it is new: the Quack
extension (released May 2026, DuckDB ≥ 1.5.3) turns any DuckDB instance into an
HTTP server that other instances query via `quack:` URIs with token auth. The
pinned engine (1.5.5) supports it — verified end-to-end through `@duckdb/node-api`
(`quack_serve`, `quack_query` with token, `ATTACH … (TOKEN …)`, `whoami()`).
Remote storage is also not "just S3": GCS (`gcs://`), R2 (`r2://`), and Azure
(`az://`) need different secret shapes (HMAC keys, `ACCOUNT_ID`,
`CONNECTION_STRING`), and HTTPS file reads, MotherDuck (`md:`), and the database
scanners (`postgres`, `mysql`, `sqlite`) are distinct families. A single generic
`remote` tab cannot express per-scheme credentials without guessing.

## Decision

Expand to one method per scheme family, each with its own flat schema:

| Method | Label | Transport / auth | Extension |
|---|---|---|---|
| `memory` | In-memory | `:memory:` | none |
| `file` | Local file | path + read-only flag | none |
| `quack` | DuckDB server | `quack:host[:port]`, token, `disableSsl` | `quack` |
| `s3` | S3 / S3-compatible | `s3://`, key/secret/session/region/endpoint/url-style | `httpfs` |
| `gcs` | Google Cloud Storage | `gcs://`/`gs://`, HMAC key/secret | `httpfs` |
| `r2` | Cloudflare R2 | `r2://`, key/secret/account-id | `httpfs` |
| `azure` | Azure Blob | `az://`, connection string | `azure` |
| `https` | HTTPS file | `https://` read-only attach + bearer secret | `httpfs` |
| `motherduck` | MotherDuck | `md:`, token | `motherduck` |
| `postgres` | PostgreSQL | `dbname=…` + secret, `ATTACH … (TYPE postgres)` | `postgres` |
| `mysql` | MySQL | `ATTACH … (TYPE mysql)` | `mysql` |
| `sqlite` | SQLite | file path, `ATTACH … (TYPE sqlite)` | `sqlite` |

Phasing: P1 ships `quack` plus the `s3`/`gcs`/`r2`/`azure` split (the generic
`remote` maps 1:1 onto `s3`). P2 adds `https` and `motherduck`, plus
`quack-serve`/`quack-stop` actions so a local instance can itself become a
server. P3 adds the `postgres`/`mysql`/`sqlite` scanners.

Client design: one small per-method `dial()` per scheme (ensure extension
installed+loaded, create scoped secret, then query or `ATTACH`) behind the
existing `DuckDbClient` interface — a lookup, not a framework. Secrets are
created per connection (`CREATE SECRET … SCOPE …`) so credentials never appear
in user SQL; Quack defaults to HTTPS except for local URIs with an explicit
`disableSsl` flag.

## Alternatives

- **Keep one generic `remote` tab**: forces one credential shape onto schemes
  that need different ones; rejected.
- **One method with a scheme dropdown inside**: reintroduces the guessing problem
  the tabs solved; rejected.
- **Server-side Quack hosting in dsui**: serving Quack from the dsui process is a
  separate product decision (TLS, multi-tenancy); this record covers the client
  side plus local `quack-serve`/`quack-stop` actions only.

## Compatibility and rollout

Additive for authors and users except one migration: existing `remote`
connections become `s3` with identical fields (documented in the adapter
changelog). Each method lands with its own tab; single combined e2e per method
against a real target (local Quack server, MinIO for S3-compat).

## Verification

Per-method connection tests: open, `SELECT version()`, catalog read, dispose —
against a real Quack server (spun up in-test), MinIO (S3-compat), and in-memory
attachment for the rest. SSRF tests assert private-range `quack:`/`https:` URLs
are rejected unless explicitly allowed. Secret redaction tests cover token echo.

## Consequences

Twelve tabs is the honest surface, but no service shows more than its own
method's fields. Quack is beta upstream — protocol, function names, and defaults
may change; the adapter pins behavior to the verified 1.5.x surface and documents
the dependency. MotherDuck stays deferred until P2.
