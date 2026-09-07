---
title: Refresh and lifecycle
description: How polling starts and stops, and the full create-to-dispose order of an instance.
---

# Refresh and lifecycle

Freshness is declared, not implemented. Each resource carries a
strategy: `poll("5s")` for warehouse status, `poll("60s")` for
catalog data, `manual()` for one-shot reads. Adapter code never calls
`setInterval`. The runtime owns every timer and guarantees each one
dies with its watcher.

## How watching works

Watching a binding mounts an execution. The runtime runs the query
immediately, delivers the result to every listener, then starts the
resource's refresh policy for background updates. Each new subscriber
to an identical binding joins the existing execution instead of
starting another fetch. Each unsubscribe removes one listener. The
last unsubscribe stops the policy and drops the entry entirely.

This gives three properties worth knowing. Different inputs poll
independently, because identity includes the normalized input. Slow
queries cannot overlap themselves: a response that arrives after a
newer run started is discarded by generation counting. And manual
resources behave identically minus the timer. They fetch on mount and
on invalidation, which is exactly right for details, DDL, and account
metadata.

Polling intervals are per resource, not global. Warehouses at five
seconds, query history at ten, logs at ten, catalog at sixty. Each
resource declares what its data needs. Timers are unref'd where the
platform supports it, so background polling never holds a process
open on its own.

## The full order

Instance creation and teardown follow a fixed order:

1. Validate configuration against `connectionSchema`, when declared.
   Rejection throws before anything is built.
2. Build the context through the `context()` factory (may be async).
3. Create adapter-scoped stores on first use, not upfront.
4. Mount pages, resources, and actions lazily as the UI uses them.
5. On `dispose()`: stop all polling, destroy all stores, then call
   `disposeContext` once.

Page scopes nest inside this order. A scope is created per navigation
with fresh page-scoped stores. `scope.dispose()` destroys those
stores and releases the scope's subscriptions, and leaves
adapter-scoped state untouched. Switching pages never disturbs the
session; disposing the instance ends everything.

A practical consequence: invalidation during disposal is harmless.
`ctx.invalidate` re-runs watchers, but disposed executors ignore new
work, so an action that resolves as its page unmounts cannot update a
dead scope.

## What to read next

- [Bindings and execution](./bindings-and-execution) for the execution model
- [Testing adapters](../guides/testing-adapters) for asserting lifecycle behavior
