---
title: Testing adapters
description: Prove runtime semantics with fake clients, isolated instances, and lifecycle assertions.
---

# Testing adapters

Adapter tests prove behavior, not structure. Bindings validate.
Queries execute. Polling starts and stops. Invalidation refetches
exactly the right bindings. Two instances stay isolated. Disposal
cleans everything up. Asserting the definition object shape proves
little; driving the runtime proves everything.

## Fake the client, keep the interface

The reference pattern is an in-memory client implementing the exact
`SnowflakeClient` interface the production client implements. Same
methods, same types, local arrays instead of HTTP:

```ts title="snowflake/fake-client.ts"
export function createFakeSnowflakeClient(seed?: Partial<FakeSeed>): SnowflakeClient {
  const warehouses: Warehouse[] = [...(seed?.warehouses ?? defaults)];
  return {
    async listWarehouses() {
      return warehouses.map((w) => ({ ...w }));
    },
    async suspendWarehouse(warehouse) {
      const found = warehouses.find((w) => w.name === warehouse);
      if (!found) throw new Error(`Unknown warehouse: ${warehouse}`);
      found.status = "SUSPENDED";
    },
    // ...
  };
}
```

Three details make fakes trustworthy. Each factory call creates
independent state, mirroring per-instance isolation, so tests can run
two instances and assert they never interact. Mutations change the
stored state (suspend flips the status), so invalidation tests observe
real refetches instead of canned responses. Seeds let individual tests
set up edge cases (empty lists, incident states) without touching
shared fixtures.

Return copies from list methods, never live references. A test that
mutates a returned array should not corrupt the fake for the next
assertion.

## Drive the runtime, assert semantics

With the fake injected through the normal `context()` factory, tests
exercise the real runtime: real polling, real invalidation, real
disposal.

```ts title="snowflake/adapter.test.ts"
test("suspend action invalidates the warehouses resource", async () => {
  const instance = await createAdapterInstance(snowflakeAdapter, CONFIG);
  const seen: string[] = [];
  const unwatch = instance.watchResource(warehouses(), (result) => {
    if (result.status === "success") seen.push(/* … */);
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  await instance.executeAction(suspendWarehouse({ warehouse: "ETL_WH" }));
  await new Promise((resolve) => setTimeout(resolve, 10));
  unwatch();
  expect(seen[0]).toContain("ETL_WH:RUNNING");
  expect(seen.at(-1)).toContain("ETL_WH:SUSPENDED");
  await instance.dispose();
});
```

Work through this checklist per adapter. Input validation: valid
calls compile, invalid calls throw (runtime) and fail typecheck
(`@ts-expect-error` in `types.test-d.ts`, checked by `tsc --noEmit`).
Binding purity: calling never executes (assert the query spy stayed
quiet). Polling: watchers fire repeatedly on their intervals,
independent intervals stay independent, and unsubscribing stops the
timers (assert call counts freeze after unwatch). Invalidation: all,
per-resource, and per-binding forms each refetch exactly their scope.
Isolation: two instances with separate stores, contexts, and
executions. Lifecycle: page disposal destroys page stores but keeps
adapter stores; instance disposal clears timers and calls the context
hook.

Two habits prevent flaky suites. Always `await instance.dispose()` at
the end of each test, or timers leak across files. Keep timing
margins generous (poll at 20ms, assert after 50ms+); CI machines are
slower than laptops.

```bash
bun test          # runtime semantics
bunx tsc --noEmit # types, including @ts-expect-error assertions
```

## What to read next

- [Instances and isolation](../concepts/instances-and-isolation) for what isolation means
- [Snowflake adapter](../examples/snowflake) for the full tested reference
