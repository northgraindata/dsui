---
title: Actions
description: Define commands and mutations with validated inputs, runtime execution, and resource invalidation.
---

# Actions

Actions are behavior: suspend a warehouse, run a query, grant a role,
create a user. An action takes validated input and performs a side
effect. It never describes presentation. Labels, buttons, and layout
belong to [components](./components); the action only does the thing.
Keeping the two apart means the same action can back a row button, a
form submit, and a future API call without changes.

## Define an action

```ts title="snowflake/actions/warehouses.ts"
import { defineAction, z } from "@northgraindata/dsui-adapter-sdk";

export const suspendWarehouse = defineAction({
  id: "suspend-warehouse",
  input: z.object({ warehouse: z.string() }),
  run: async ({ warehouse }, ctx: Ctx & ActionRuntimeContext) => {
    await ctx.client.suspendWarehouse(warehouse);
    ctx.invalidate(warehouses);
    return { warehouse, status: "SUSPENDED" };
  },
});
```

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `id` | `string` | required | Unique within the adapter. Must be non-empty. |
| `input` | `ZodType` | none | Binding-input schema. Omit for inputless actions. |
| `run` | `(input, ctx) => data` | required | The side effect. May be async and long-running. |

The `input` schema plays the same double role as in resources:
runtime validation plus compile-time inference, so `resize({ size:
"HUGE" })` fails `tsc` against an enum schema. Share the schema object
between the action and its form and the two can never disagree:

```ts title="snowflake/actions/warehouses.ts"
export const resizeWarehouseInput = z.object({
  warehouse: z.string().min(1),
  size: z.enum(["XSMALL", "SMALL", "MEDIUM", "LARGE", "XLARGE"]),
});
```

The form in the warehouses page references this exact object. Add a
size and both sides accept it.

## Receive a context with helpers

`run` gets the instance context plus runtime helpers. Annotate the
parameter as `MyContext & ActionRuntimeContext` to see them:

- `ctx.invalidate(...)` re-runs watched bindings. Narrow it: all, one
  resource, or one binding (see [Resources](./resources)).
- `ctx.signal` carries the caller's abort signal for cancellable work.

The augmentation preserves the original prototype and adds helpers as
non-enumerable properties, so spreading the context never leaks them.
Plain `console.log` debugging still shows a clean object.

## Execution returns unions

Calling an action validates input and returns a binding. Nothing runs
yet, exactly like resources. `executeAction` runs it and returns
`{ status: "success", data }` or `{ status: "error", error }`. A
failing client call becomes an error result, not a throw. Pages and
renderers branch on `status` without try/catch.

## Invalidate what you change

End every mutation with the invalidation its reads need, or the UI
shows stale data after success. The Snowflake adapter follows one
pattern everywhere: mutate, invalidate the affected resources, return
a small confirmation record.

```ts title="snowflake/actions/tasks.ts"
run: async ({ database, schema, task }, ctx) => {
  await ctx.client.suspendTask(database, schema, task);
  ctx.invalidate(tasks, { database, schema });
  ctx.invalidate(taskDetails);
  return { database, schema, task, status: "SUSPENDED" };
},
```

Note the two granularities in one action: the list invalidated for
its own schema binding, the details invalidated wholesale. Prefer the
narrowest form that stays correct.

## Long-running and cancellable work

`runQuery`, task runs, and procedure calls share one shape. The
runtime tracks running, success, and error per execution, accepts an
abort signal through execution options, and `cancelQuery` shows the
cancellation action. Progress reporting can extend this shape later
without changing adapter code, because executions are runtime-owned.

What the SDK cannot do yet: feed an action's result back into a
store. After Run, the new query appears in history (invalidated), but
no primitive captures the returned query id into editor state. That
gap is tracked in the Snowflake coverage ledger, not worked around.

## What to read next

- [Components](./components) for binding actions to buttons and forms
- [Bindings and execution](../concepts/bindings-and-execution) for the execution model
