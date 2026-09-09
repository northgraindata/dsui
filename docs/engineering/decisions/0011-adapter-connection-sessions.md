# 0011: Adapter connection sessions

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

The page, resource, and action HTTP routes currently create and dispose an adapter
instance for each request. This makes an in-memory DuckDB database, query history,
and cancellation state disappear between requests. Browser-side editor state does
not solve this server-side lifecycle gap.

## Decision

Introduce a service-scoped, server-owned adapter connection session with a bounded
idle lifetime and explicit disposal. All page, resource, and action requests for a
service resolve the same session while it is live. The browser never receives
adapter instances, credentials, or session handles that grant direct access.

## Alternatives

- Keep one instance per request: safe but cannot support an interactive in-memory
  DuckDB workspace; rejected.
- Make only DuckDB stateful in the web app: violates adapter-neutral server
  ownership; rejected.
- Persist adapter objects in the browser: crosses the trust boundary; rejected.

## Compatibility and rollout

The initial rollout is additive and used by the built-in DuckDB adapter. Existing
stateless adapters retain the current request lifecycle until they opt in. Idle
expiry is observable as a new connection session and must be communicated by the
UI when relevant.

## Verification

Server tests prove that a table created through one request is visible through a
later request, that expired sessions dispose their context, and that sessions do
not leak between services or principals.

## Consequences

The server gains explicit ownership of long-lived provider clients and must bound
their number, lifetime, cancellation, and cleanup.
