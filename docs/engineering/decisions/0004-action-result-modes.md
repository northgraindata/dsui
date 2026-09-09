# 0004: Action result modes (json / binary / stream)

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

Adapters can return only JSON-serializable action results today. DuckDB (and other
engines) need to return generated artifacts — e.g. Parquet/CSV from `COPY ... TO` —
as a browser download. The server plan already commits to unary JSON, streaming
NDJSON, and binary operation responses. Copy-to-clipboard and CSV/JSON export of
already-loaded rows operate on data the browser already holds and should not round-trip
through a server action.

## Decision

Extend `defineAction` with an optional `result: { mode: "json" | "binary" | "stream" }`
(default `json`). A `binary` action returns `{ filename, mime, data: Uint8Array }`;
the server serializes it as a binary HTTP response with `Content-Disposition`. A
`stream` mode is reserved for chunked/NDJSON responses and is specified only at the
transport level in v1.

Clipboard copy and CSV/JSON export are **renderer controls** on the result table, not
SDK actions: they serialize rows already in memory and use `navigator.clipboard` or a
Blob download. DuckDB's `export-data` action uses `mode: "binary"`.

## Alternatives

- **Separate `defineExport` primitive**: duplicates action lifecycle for a single
  result shape; rejected.
- **Download URLs / temporary files**: adds server-side temp-file cleanup and a
  second auth surface; rejected for v1.
- **Client-side generation for engine formats**: Parquet cannot be produced in the
  browser; a server binary path is required regardless.

## Compatibility and rollout

Additive; the default `json` mode preserves all existing action behavior. Binary
actions must declare their mode so the server can validate and serialize the
response without leaking secrets. Limits (max payload size) apply before buffering.

## Verification

HTTP serialization tests prove a binary action yields the correct Content-Type and
`Content-Disposition` and that credentials are not echoed. Renderer tests cover
clipboard and CSV/JSON export. A Parquet round-trip integration test exercises the
DuckDB path.

## Consequences

Large exports are bounded by the binary payload limit; chunked `stream` mode is the
follow-up when multi-GB exports are required. Clipboard/CSV/JSON correctness depends
on the value normalizer (0002), which is tested independently.
