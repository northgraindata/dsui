![DSUI Adapter SDK — Connect your stack to DSUI.](./assets/banner.png)

[Documentation](https://dsui.northgraindata.com/docs/adapter-sdk) · [Example adapter](../../examples/example-adapter) · [Source](./src/index.ts) · [Plugin SDK](../plugin-sdk)

# DSUI Adapter SDK

Build typed integrations that bring your data and infrastructure tools into DSUI. Define connections, resources, actions and pages; DSUI handles execution and rendering.

Package name: `@northgraindata/dsui-adapter-sdk`.

## Get started

Install the public SDK package:

```sh
bun add @northgraindata/dsui-adapter-sdk
```

Import `@northgraindata/dsui-adapter-sdk/styles.css` once in the consuming app to load the shared UI and adapter component styles. Those UI primitives ship inside this package; no separate DSUI UI package is needed. DSUI also ships a tested SDK copy for runtime extension builds. See the [release policy](https://dsui.northgraindata.com/docs/releases).

Start with the [example adapter](../../examples/example-adapter). It includes a connection schema, resource, action, page, custom browser component and tests. The [DuckDB adapter](../adapter-duckdb) is a larger reference implementation.

## Define a resource

Resources describe reads from an external system. This small example exposes the configured endpoint; replace the query with your integration's read operation.

```ts
import { defineResource } from "@northgraindata/dsui-adapter-sdk";

interface Context {
  config: { baseUrl: string };
}

export const endpoint = defineResource({
  id: "endpoint",
  query: async (_input: undefined, context: Context) => ({
    url: context.config.baseUrl,
  }),
});
```

Register the resource in `defineAdapter`. See the [example composition root](../../examples/example-adapter/src/adapter.ts) for connection methods, context creation, health checks, actions and pages.

## What you can build

| Capability | Purpose |
| --- | --- |
| Connections | Validate service configuration with Zod schemas. |
| Resources | Expose typed reads from the connected system. |
| Actions | Declare validated mutations and operations. |
| Pages | Compose a service interface from shared UI primitives. |
| Components | Add reusable compositions or custom browser components. |
| Health checks | Report the availability of your integration. |

## Runtime and compatibility

DSUI builds configured adapter sources and executes them in an `adapter-host` subprocess. Review third-party adapter code before installing it; process isolation does not make the source build a sandbox.

The host checks `apiVersion` against `ADAPTER_API_VERSION`, independently from the npm package version. Legacy definitions use the `sdkVersion` compatibility marker. Check the API contract and required host capabilities for the DSUI runtime you target.

Plugin authors can use the [Plugin SDK](../plugin-sdk), which also exposes shared page components from this SDK.

## Develop in this repository

From the repository root, after installing dependencies:

```sh
bun run --filter @northgraindata/dsui-adapter-sdk test
bun run --filter @northgraindata/dsui-adapter-sdk typecheck
```

Run affected adapter tests and typechecks when changing SDK behavior. See [CONTRIBUTING.md](../../CONTRIBUTING.md) for repository checks and contribution guidance.

## License

[Apache License 2.0](../../LICENSE), developed by [Northgrain Data](https://northgraindata.com).
