# 0001: Snowflake client hardening

Status: Proposed
Owner: dsui maintainers
Review: Pending maintainer review

## Problem and constraints

The exported Snowflake adapter uses an in-memory client. Its SQL API client is
untested and can discard query context, misread catalog names, interpolate SQL
values, and return incomplete results as success. The user approved addressing
these findings. Preserve the lightweight SDK and server-side credential boundary.

## Decision

Harden the existing client before making it the default. Keep a factory for
explicit client injection in tests and demos. Separate bounded SQL API transport
from provider operations. Validate HTTP data with Zod, use bind variables for
values and quote identifiers, and reject unsupported SQL fragments. Never retry
a statement submission automatically. Poll existing handles within a deadline;
read every partition within explicit row/byte limits or fail without partial
success. Do not expose raw provider error bodies or credentials.

Per-call non-null query context overrides connection defaults; null means use the
connection default. Action cancellation is cooperative and must reach fetch.
Remote cancellation is best effort after a handle is known; an interrupted POST
may have reached Snowflake without returning its handle.

## Alternatives

Keeping the fake default hides integration failures. Adding a full vendor driver
is unnecessary for the existing SQL API scope. Expanding enterprise authorization
and the browser protocol here would mix independent contract redesigns into a
provider reliability fix.

## Compatibility and rollout

The default adapter will contact Snowflake on resource/action execution. Tests
and demos must call `createSnowflakeAdapter(createFakeSnowflakeClient)` explicitly.
Connection creation remains lazy and is not a remote authentication probe.
Invalid structured SQL inputs and malformed or oversized responses become errors.
Procedure arguments are JSON scalar arrays rather than executable SQL fragments.
The existing empty argument string continues to mean no arguments.

## Implementation and verification

1. Reproduce real-client failures using HTTP fixtures and Bun Test.
2. Correct SQL construction and result mapping; rerun focused tests/typechecks.
3. Implement validated, bounded transport and cancellation with regression tests.
4. Wire production and explicit fake factories; test through the SDK runtime.
5. Add an opt-in read-only live smoke check and document support limitations.
6. Run SDK/adapter tests, root checks/build, and inspect the final diff.

No new dependencies, database migrations, publishing, or live mutations are needed.
Live checks require an explicitly configured account; fixture tests do not establish
live compatibility or complete Snowflake feature coverage.

## Consequences

Results exceeding limits fail explicitly; cursor-based browsing remains future
work. Enterprise operation permissions, end-to-end page serialization, published
SDK packaging, and complete live adapter conformance require separate changes.
Maintainers should require live evidence for each capability before promoting it
from experimental support.
