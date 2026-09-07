---
title: Instances and isolation
description: One adapter definition serves many isolated instances with separate context, stores, and execution.
---

# Instances and isolation

A definition describes a supported system. `snowflake` is a
definition. An instance is one configured connection:
`snowflake-prod`, `snowflake-dev`, a teammate's trial account. The
same definition serves all of them, and each instance is fully
isolated from the others.

Isolation covers three things. The **context** holds per-instance
dependencies: its own client, its own validated config, its own
logger. **Adapter-scoped stores** hold per-instance session state, so
selecting a warehouse in prod never touches dev. **Executions** hold
per-instance watchers, timers, and cached results, keyed by binding.

```ts title="ops/prod-and-dev.ts"
const prod = await createAdapterInstance(snowflakeAdapter, prodConfig);
const dev = await createAdapterInstance(snowflakeAdapter, devConfig);

prod.store(sessionStore).actions.setWarehouse("PROD_WH");
dev.store(sessionStore).get().warehouse; // null, fully isolated

await prod.dispose();
await dev.dispose();
```

This works because definitions hold no mutable state. Everything that
changes at runtime hangs off an instance: store instances created per
scope, executions created per watcher, contexts created per config.
There are no module-level singletons in adapter code, and the SDK
gives you no place to put one.

Configuration is validated before the context factory runs. If the
connection schema rejects the config, `createAdapterInstance` throws
and no context, store, or execution is ever created. Partially built
instances cannot exist.

Disposal mirrors creation in reverse. `dispose()` stops polling first,
so no timer fires during teardown. Then it destroys stores, which
releases every subscription. Then it calls the optional
`disposeContext` hook for pools and clients. Calling dispose twice is
safe.

Tests lean on this design. The fake client creates fresh state per
call, so two instances in one test file prove isolation the same way
production relies on it. If your adapter keeps state anywhere outside
an instance, those tests will catch it.

## What to read next

- [Refresh and lifecycle](./refresh-and-lifecycle) for teardown ordering
- [Context](../guides/context) for building per-instance dependencies
