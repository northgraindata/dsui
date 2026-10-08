# Adapter test harness

`@northgraindata/dsui-adapter-test` provides a small, framework-agnostic
harness for testing adapters through the public DSUI adapter SDK runtime.

It does not start the DSUI server or require the web application. Adapter tests
can provide an in-memory client, mock external services, and exercise the same
configuration validation, context lifecycle, stores, resources, and actions
that the host uses.

```ts
import { withAdapterTest } from "@northgraindata/dsui-adapter-test";
import adapter from "./adapter.js";
import { query } from "./resources.js";

test("lists records", async () => {
  await withAdapterTest(adapter, { url: "mock://test" }, async ({ instance }) => {
    const result = await instance.executeResource(query({}));
    expect(result).toEqual({
      status: "success",
      data: [{ id: "one" }],
    });
  });
});
```

The callback is awaited and the adapter instance is always disposed, including
when the test throws. For tests that need manual lifecycle control, use
`createAdapterTest` and call the returned `dispose` function in teardown.

The package intentionally depends only on `@northgraindata/dsui-adapter-sdk`.
An adapter outside the DSUI monorepo can use the published SDK and this package
without importing server or renderer internals.
