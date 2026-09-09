---
title: Context
description: Build per-instance runtime dependencies, clients, loggers, and validated config, in a context factory.
---

# Context

Context is the environment one adapter instance runs in: the API
client, the logger, the validated configuration. Every resource query
and every action receives it. It holds runtime dependencies only.
Selected warehouse goes in a store. Filters go in a store. The client
that talks to Snowflake goes in context.

## Define the factory

```ts title="snowflake/adapter.ts"
defineAdapter({
  metadata: { id: "snowflake", name: "Snowflake", version: "1.0.0" },
  connectionMethods: {
    snowflake: { label: "Snowflake", schema: snowflakeConnectionSchema },
  },
  context: (config) => createContext(createSnowflakeClient(config), config),
  // ...
});
```

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `connectionMethods` | `Record<string, method or group>` | none | Named connection methods; each validates its own fields in `createAdapterInstance`. |
| `context` | `(config) => ctx` | `{}` | Builds per-instance dependencies. May be async. |
| `disposeContext` | `(ctx) => void` | none | Releases pools and clients on instance disposal. |

A method entry is `{ label, description?, schema }`. A group entry replaces
`schema` with nested `methods` and renders as sub-tabs; validation still
discriminates on the leaf method id, so the parsed config never names a
group.

Configuration is validated before the factory runs, so `config`
inside is always well-typed. If validation rejects, the instance is
never created: no half-built contexts, no stores, no executions. The
factory itself may be async for clients that connect on creation.
Keep it focused on construction. Connection pools, authenticated
sessions, and loggers belong here. Anything the UI can change belongs
in a store.

Adapters with no external dependencies omit both the schema and the
factory. The context defaults to an empty object, and resources close
over module state only in tests. The hello adapter in the quickstart
works exactly this way.

## Use it in queries and actions

Resources and actions receive the built context. Type it once per
adapter and reuse the alias everywhere:

```ts title="snowflake/resources/databases.ts"
query: ({ database }, ctx: SnowflakeContext) => ctx.client.listSchemas(database),
```

Actions see the same context plus runtime helpers. Annotate the
parameter with `& ActionRuntimeContext` to unlock `ctx.invalidate`
and `ctx.signal`:

```ts
run: async ({ warehouse }, ctx: Ctx & ActionRuntimeContext) => {
  await ctx.client.suspendWarehouse(warehouse);
  ctx.invalidate(warehouses);
},
```

The augmentation preserves the original prototype and adds helpers
as non-enumerable properties. Spreading the context never leaks
them, and plain logging still shows a clean object.

## Dispose what you create

Clients with pools or persistent connections need `disposeContext`.
The runtime calls it once, after polling stops and stores are
destroyed. Creation order reversed: timers, state, then connections.

## What to read next

- [Instances and isolation](../concepts/instances-and-isolation) for per-instance state
- [Testing adapters](./testing-adapters) for injecting fake clients
