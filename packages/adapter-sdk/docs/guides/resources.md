---
title: Resources
description: Expose external data as parameterized, runtime-managed resources with inputs, refresh, and invalidation.
---

# Resources

A resource is a parameterized source of external data: databases,
warehouses, query history, logs. You write the query and declare how
fresh the data must stay. The runtime fetches, refreshes, retries in
the sense of surfacing errors, and cleans up. The most important thing
to internalize: calling a resource never fetches. It makes a binding.

## Define a resource

```ts title="snowflake/resources/databases.ts"
import { defineResource, poll, z } from "@northgraindata/dsui-adapter-sdk";

export const schemas = defineResource({
  id: "schemas",
  input: z.object({ database: z.string() }),
  query: ({ database }, ctx: SnowflakeContext) =>
    ctx.client.listSchemas(database),
  refresh: poll("60s"),
});
```

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `id` | `string` | required | Unique within the adapter. Must be non-empty. |
| `input` | `ZodType` | none | Binding-input schema. Omit it for inputless resources. |
| `query` | `(input, ctx) => data` | required | Fetches from validated input and context. May be async. |
| `refresh` | `RefreshStrategy` | `manual()` | `poll("5s")` or `manual()`. |

The `input` schema does double duty. At runtime it validates and parses
every binding call, applying defaults and coercions. At compile time it
types the binding arguments, so `schemas({ database: 123 })` fails
`tsc` before it can fail in production. The query receives the Zod
*output* side, which means your code sees defaults already applied.

`query` gets the instance context as its second argument. Keep it
honest: read the client, read the config, return data. UI state has no
business here. If the query needs the selected warehouse, that value
arrives as input, passed down from a store by the page. This keeps
resources testable with a bare context and no rendering.

Resources without parameters skip the schema entirely:

```ts title="snowflake/resources/warehouses.ts"
export const warehouses = defineResource({
  id: "warehouses",
  query: (_, ctx: SnowflakeContext) => ctx.client.listWarehouses(),
  refresh: poll("5s"),
});
```

Call it bare: `warehouses()`. The binding input is `undefined`.

## Call it to bind, not to fetch

```ts title="snowflake/pages/databases.ts"
Table({ source: schemas({ database: "ANALYTICS" }) });
```

The call validates and returns `{ resourceId, input, definition }`.
The query does not run, no timer starts, nothing is cached. That is
what makes bindings safe to create inside render functions and pass
around as props. Components accept the structural `DataSource` shape,
so UI code never needs the resource's generics.

Invalid input throws the schema's `ZodError` at binding time:

```ts
schemas({ database: 123 }); // throws ZodError, immediately
```

Fail fast here is a feature. A typo in a page surfaces in the test
run, not as a mysterious empty table.

## Refresh on a schedule, or not at all

Different data goes stale at different speeds, so each resource
declares its own strategy:

```ts
refresh: poll("5s"),   // warehouse status, anything operational
refresh: poll("10s"),  // query history, task history, logs
refresh: poll("30s"),  // dynamic tables, copy history, monitors
refresh: poll("60s"),  // databases, schemas, access history
refresh: manual(),     // details, DDL, account metadata (the default)
```

Polling starts with the first watcher and stops with the last
unsubscribe. Two pages watching the same binding share one timer.
Navigating away tears everything down. Manual resources fetch on mount
and on invalidation, which is exactly right for data that only changes
when someone acts on it.

Pick the longest interval your UI can tolerate. Five seconds feels
live for warehouse status; sixty seconds is plenty for a schema list
nobody edits mid-session.

## Invalidate from actions

Reads go stale when writes happen. Every mutation should invalidate
exactly the resources it affects, through `ctx.invalidate` at the end
of `run`:

```ts title="snowflake/actions/warehouses.ts"
run: async ({ warehouse }, ctx) => {
  await ctx.client.suspendWarehouse(warehouse);
  ctx.invalidate(warehouses);
  return { warehouse, status: "SUSPENDED" };
},
```

Invalidation narrows in three steps:

| Call | Re-runs |
| ---- | ------- |
| `ctx.invalidate()` | Every watched binding in the instance |
| `ctx.invalidate(warehouses)` | All bindings of one resource |
| `ctx.invalidate(tasks, { database, schema })` | The single matching binding |

Prefer the narrowest form that stays correct. Invalidating everything
is simple and always correct, but on a busy page it refetches data the
mutation never touched. The task actions show the narrow form: a task
mutation invalidates the task list for its own schema plus the detail
resource, and nothing else.

## Common mistakes

Storing fetched rows in a store is the classic one. It duplicates the
runtime's job, goes stale on its own schedule, and breaks instance
isolation. If the data came from a service, it lives in a resource.
Stores hold the *selection* (which warehouse, which filter text), and
pages feed that selection into bindings as input.

The other mistake is fetching inside `query` from anything but the
client and config. Reaching into stores, globals, or other resources
from a query makes execution order matter and tests painful. Input in,
data out.

## Where adjacent concerns live

| Concern | Lives in |
| ------- | -------- |
| Local, session, and UI state | [Stores](./stores), never resources |
| Mutations and commands | [Actions](./actions) |
| Execution, polling, teardown | [Refresh and lifecycle](../concepts/refresh-and-lifecycle) |

## What to read next

- [Stores](./stores) for filters and session state that feed resource inputs
- [Actions](./actions) for mutations that invalidate resources
