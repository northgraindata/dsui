# 0014: Virtualized query results without a row cap

Status: Proposed
Owner: accountable maintainer
Review: PR

## Problem and constraints

The DuckDB adapter rejected any ad-hoc result over 10,000 rows
(`duckdb-client.ts`, `MAX_ROWS`), forcing users to add `LIMIT` even for
legitimate exploration of 100k+ row tables. The cap existed because the
results table rendered every row as a DOM node, so large results hung the
browser tab. It never protected the server: `runAndReadAll` materializes the
full result before the count check runs.

## Decision

- Render query result rows virtualized with `@tanstack/react-virtual`
  (3.x, MIT, headless, ~7 kB, React 19 compatible): only visible rows plus a
  small overscan exist in the DOM. Rows are fixed-height with top/bottom
  spacer rows; `aria-rowcount`/`aria-rowindex` preserve table semantics.
- Remove the 10,000-row rejection from DuckDB ad-hoc reads. The table-preview
  clamp (`PREVIEW_MAX_ROWS`) stays, since previews take a caller-supplied
  `LIMIT` that must still be sanitized.
- Snowflake adapter keeps its own limit; this decision covers DuckDB only.

## Alternatives

- Raising the cap (e.g. 100k): still arbitrary, still fails on the next
  larger table. Rejected.
- Server-side cursor pagination (see 0003): the principled long-term fix,
  but a larger protocol change across SDK, host, and renderer. Deferred;
  revisit if unbounded payloads cause real problems.

## Compatibility and rollout

The `run-query` action returns the same shape; only the
"Result exceeds row limit" error string disappears. No typed contract
changes, no migration needed. Rollback: re-add the count check.

## Verification

- New adapter test reads 15,000 rows through `run-query` against a real
  in-memory instance and asserts success with all rows.
- Renderer typecheck plus existing renderer and adapter-duckdb suites.

## Consequences

Result payloads are now unbounded: browser JS memory grows with result size
(the DOM does not, due to virtualization) and the server materializes every
result as before. For a local-first, single-user tool this is acceptable;
cancel (`interrupt()`) still aborts a running query. If large-result pain
appears, the follow-up is cursor pagination per 0003, owned by whoever picks
it up with acceptance criteria around first-page latency and total memory.
