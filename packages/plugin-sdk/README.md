![DSUI Plugin SDK — Extend your DSUI workspace.](./assets/banner.png)

[Documentation](https://dsui.northgraindata.com/docs/plugin-sdk/overview) · [Example plugin](../../examples/example-plugin) · [Source](./src/index.ts) · [Adapter SDK](../adapter-sdk) · [DSUI](../../README.md)

# DSUI Plugin SDK

Extend DSUI with workspace pages, navigation, UI slots and typed procedures. Use shared page components to give your plugin the same interface primitives as the host.

Package name: `@northgraindata/dsui-plugin-sdk`.

## Get started

The SDK is packaged independently for Bun and TypeScript-aware bundlers. DSUI also ships a tested SDK copy for runtime extension builds. The first registry publication requires maintainer setup; see the [release policy](https://dsui.northgraindata.com/docs/releases).

Start with the [example plugin](../../examples/example-plugin). It demonstrates configuration, pages, navigation, UI slots, procedures and the host's service catalog capability.

## Define a plugin

This plugin registers a validated greeting procedure:

```ts
import {
  definePlugin,
  PLUGIN_API_VERSION,
  z,
} from "@northgraindata/dsui-plugin-sdk";

export default definePlugin({
  metadata: {
    id: "greeting",
    name: "Greeting",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
  },
  configSchema: z.object({
    greeting: z.string().default("Hello"),
  }),
  setup(registry) {
    registry.procedure({
      id: "greet",
      permission: "inspect",
      input: z.object({ name: z.string().min(1) }),
      output: z.string(),
      handler: (context, input) =>
        `${context.config.greeting}, ${input.name}`,
    });
  },
});
```

See the [example plugin README](../../examples/example-plugin/README.md) for loading a plugin in `dsui.yaml` and shipping browser components.

## What you can build

| Capability | Purpose |
| --- | --- |
| Pages and navigation | Add workspace views and entry points. |
| UI slots | Contribute widgets to host extension points. |
| Procedures and actions | Expose validated operations with declared permissions. |
| Resources | Supply data for plugin pages. |
| Stores and jobs | Define plugin storage and background work. |
| Shared components | Compose interfaces using the Adapter SDK's page primitives. |

## Runtime and compatibility

Trusted plugins run in the DSUI server process. Install code you trust.

The host checks `metadata.apiVersion` against `PLUGIN_API_VERSION`. This API marker is separate from the plugin's own version and the SDK package version.

The Plugin SDK currently depends on the [Adapter SDK](../adapter-sdk) for shared page types and components. A standalone release must provide a compatible dependency version; the two SDKs do not need identical package versions.

## Develop in this repository

From the repository root, after installing dependencies:

```sh
bun run --filter @northgraindata/dsui-plugin-sdk test
bun run --filter @northgraindata/dsui-plugin-sdk typecheck
```

Run affected plugin checks when changing SDK behavior, and host integration checks when changing runtime contracts. See [CONTRIBUTING.md](../../CONTRIBUTING.md) for repository checks and contribution guidance.

## License

[Apache License 2.0](../../LICENSE), developed by [Northgrain Data](https://northgraindata.com).
