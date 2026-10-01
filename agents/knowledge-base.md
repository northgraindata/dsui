# Knowledge base

This document describes a general approach to learning a codebase before making
changes. Repository-specific contracts and facts belong in their canonical
documentation, not in generic agent guidance.

## Before changing code

1. Identify the affected behavior, entry points, callers, and data flow.
2. Read the nearest contribution, architecture, and testing guidance.
3. Inspect existing tests and established patterns around the affected code.
4. Check the working tree and preserve changes unrelated to the task.

## While implementing

- Make one coherent change at a time.
- Prefer existing abstractions when they fit; do not add an abstraction for a
  single use without a clear benefit.
- Keep boundaries explicit and validate data where it enters a subsystem.
- Consider failure states, resource lifecycle, security, and compatibility.

## Before handoff

- Run focused checks first, then the relevant broader checks.
- Inspect the final diff for scope, formatting, and accidental changes.
- Report what changed, what was checked, and any unresolved limitations.
