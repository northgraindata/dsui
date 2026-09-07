---
title: Bindings and execution
description: Definitions describe capabilities, bindings capture intent, and the runtime owns execution.
---

# Bindings and execution

Three different things, and most confusion in adapter code comes from
mixing them up.

**Definition** is static and global. `schemas` says that schemas can be
listed for a database. It holds no data, no loading flags, no
subscriptions, no timers. You can import it anywhere and it costs
nothing. Definitions are what `defineResource` and `defineAction`
return.

**Binding** is intent plus validated input. `schemas({ database:
"ANALYTICS" })` says *which* schemas are wanted, right now, for this
part of the UI. Creating a binding validates the input against the
Zod schema (defaults and coercions applied) and returns a plain
object: `{ resourceId, input, definition }`. Creating one executes
nothing. This is why components can take bindings as props and pages
can build them inside render functions without side effects.

**Execution** belongs to the runtime. Given a binding, the runtime
runs the query, tracks the outcome, refreshes while anyone watches,
and tears everything down when interest ends. Outcomes are unions,
never throws:

```ts title="anywhere.ts"
const binding = schemas({ database: "ANALYTICS" }); // validates, no fetch
await instance.executeResource(binding);            // one-shot run
const stop = instance.watchResource(binding, render); // live plus polling
stop();                                             // torn down
```

Actions follow the identical split. `defineAction` makes the
definition, calling it makes the binding, `executeAction` runs it and
returns `{ status: "success", data }` or `{ status: "error", error }`.

Identity falls out of this design. A binding is identified by its
resource id plus normalized input, so two identical bindings share one
execution instead of fetching twice, and different inputs never
collide. Invalidation uses the same identity: narrow by resource, or
by resource plus input, to re-run exactly what a mutation affected.

One common mistake is storing execution state in the definition, like
a `loading` flag next to the query. That breaks the moment two pages
watch the same resource with different inputs. Runtime state lives in
executions, which the runtime creates and destroys. Definitions stay
dumb.

## What to read next

- [Refresh and lifecycle](./refresh-and-lifecycle) for polling and teardown
- [Resources](../guides/resources) for the author-facing API
