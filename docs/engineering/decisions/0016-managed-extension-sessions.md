# 0016: Managed service sessions and restart-backed extension actions

Status: Accepted for implementation by user; maintainer review pending

## Context

DuckDB v1.5.5 rejects UNLOAD and RELOAD. A loaded extension belongs to a database
instance. The previous per-request adapter lifetime also discards Load state
before the next request. The user approved explicit restart semantics, including
loss of in-memory data and temporary/session state.

## Decision

The host owns sessions keyed by configured service ID, never connection JSON.
Operations are serialized per session. Requests without service identity remain
one-shot. A session is closed on removal, changed configuration, or shutdown.
Capacity is bounded and exhaustion is reported instead of silently evicting
state. Local and subprocess backends must preserve the same ownership semantics.
Restart remains an adapter action, because restoring engine state is provider
specific. It requires a literal confirmation input at the server boundary.

DuckDB rejects restarting a built-in extension as Unload. For a dynamically loaded
extension, restart captures the loaded dynamic extension set, closes the current
instance, reopens it with original configuration, and reloads that set with or
without the selected extension. It verifies final state and surfaces failures.
Automatic loading is disabled on the restarted instance to prevent silently
undoing Unload. Restart is not atomic: failures after closing the original
instance are reported and must not claim rollback. Installed files remain.

Generic presentation components own filtering, tabs, metadata, code samples,
status, and confirmation UI. Adapter resources own extension facts and capability
restrictions. No DuckDB-specific operation-name dispatch enters the renderer.

## Compatibility and verification

Backend service-identity arguments are additive; one-shot callers keep their
existing lifetime. `runtime.close()` is asynchronous and must be awaited to finish
session cleanup. Pools allow 64 sessions and 128 queued operations per session.
Built-in, startup-required, and remote DuckDB extensions reject restart actions.
Exercise local
and subprocess retention, independent equal-config services, concurrent calls,
cleanup, malformed/oversize protocol output, and adapter restart confirmation.
Renderer/SDK additions require serialization and malformed payload tests plus
browser verification of actions and both visual references.
