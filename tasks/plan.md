# Extensions list, details, and managed sessions

Approved scope: both supplied visual references, generic presentation components,
and restart-backed Unload/Reload with explicit destructive-state confirmation.
The user approved restart semantics on 2026-09-09.

## Build order

1. Generic service session ownership: retain SDK instances by service ID, serialize
   operations, bound session count, dispose on removal/config change/shutdown.
   Preserve isolated one-shot calls when no service ID is supplied.
2. DuckDB restart action: require confirmation, reject built-ins, reopen the
   instance, restore other loaded extensions, verify the selected result.
3. Generic catalog/detail presentation contract and SDK serialization, then
   renderer components with filtering, tabs, copy, and confirmation dialogs.
4. DuckDB metadata and page composition; reference-matched scoped chrome/styles.
5. Browser comparison and interaction checks, focused tests, root checks, review.

Local and subprocess execution must share session semantics. Unknown or lost
sessions must not silently pretend to preserve temporary database state.
No arbitrary extension downloads are required for tests; use existing fixtures
and installed extensions where possible.

Tasks and checkpoints: [todo.md](todo.md).
