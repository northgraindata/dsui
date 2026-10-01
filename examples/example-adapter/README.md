# Example adapter

A minimal but complete DSUI adapter. It demonstrates every primitive —
metadata, connection methods, context, resources, actions, pages — plus
both forms of `defineComponent`: a server-side composite and a browser
component.

It is intentionally small. A real adapter is the same shape with more
files; the `packages/adapter-duckdb` source is the full reference.

## Structure

```
example-adapter/
├── package.json          workspace package + SDK dependency
├── tsconfig.json
└── src/
    ├── adapter.ts        composition root: defineAdapter
    ├── context.ts        connection schema + context factory
    ├── resources.ts      one resource (read) + one action (mutation)
    ├── pages.ts          one page, composed from SDK components
    ├── components.ts     defineComponent (render + path)
    ├── components/
    │   └── greeting.tsx  the browser component implementation
    └── adapter.test.ts   boots the adapter without a browser or network
```

## The primitives

An adapter declares *what exists* in an external system. DSUI owns
execution, refreshing, rendering, and the browser. Adapter code never
fetches on its own timers, never manages subscriptions, and never writes
markup.

| Primitive | Constructor | This example |
| --- | --- | --- |
| Adapter | `defineAdapter` | `adapter.ts` |
| Connection | `connectionMethods` | a single `http` method with a Zod schema |
| Context | `context` | holds `config` |
| Resource | `defineResource` | `status` reads the configured URL |
| Action | `defineAction` | `ping` returns a confirmation |
| Page | `definePage` | `/` composes the UI |

The adapter is a plain module, so it can be booted directly in a test —
no browser, no network, no DSUI server:

```ts
const instance = await createAdapterInstance(adapter, {
  baseUrl: "http://localhost:4192",
});
const nodes = instance.createPageScope("/").render();
await instance.dispose();
```

## Custom components: `defineComponent`

`defineComponent` is the same mechanism behind every SDK component, in
two modes.

### `render` — a server-side composite

`render` returns builtin nodes evaluated on the server. Use it for
reusable adapter chrome (a status card, a session bar, a standard header).

```ts
export const StatusCard = defineComponent<{ title?: string }, CardNode>({
  id: "status-card",
  render: ({ title }) =>
    Card({ title: title ?? "Endpoint", content: Value({ source: status(), field: "url" }) }),
});
```

No browser code is involved; the composite composes SDK primitives and
runs everywhere.

### `path` — a browser component

When a genuinely custom visual is needed, `path` points at a `.tsx`
module. Calling it returns a `"custom"` node with JSON-serializable
props — no React, HTML, or CSS crosses the server boundary.

```ts
export const Greeting = defineComponent<{ name: string; message?: string }>({
  id: "example/greeting",
  path: "./components/greeting.tsx",
});
```

The implementation is a React component in `components/`. It receives
the renderer `client` (for `executeAction` / `executeResource` /
`navigate`) and its serialized node, and reads props from
`node.props.props`:

```tsx
export default function Greeting({ client, node }) {
  const props = (node.kind === "custom" ? (node.props.props ?? {}) : {}) as GreetingProps;
  return <div onClick={() => client.executeAction({ actionId: "ping", input: {} })} />;
}
```

Browser components render from the adapter's browser bundle. The `render`
composite works from source; the `path` component needs the release
bundle (or the renderer's dev glob for `packages/adapter-*`) before it
appears.

## Load it

Point DSUI at the adapter's source. DSUI installs its dependencies, bundles
`src/adapter.ts` into a single file, and runs it in an isolated `adapter-host`
subprocess. The same applies to a first-party adapter and a third-party one.

From a directory on this machine:

```yaml
# dsui.yaml
adapters:
  example:
    source: local
    path: ./examples/example-adapter

services:
  - id: demo
    adapter: example
    connection:
      baseUrl: http://localhost:4192
```

From a GitHub repository. Paste the URL from the tree view; the ref and
subdirectory are read out of it:

```yaml
adapters:
  example:
    repository: "https://github.com/your-org/dsui-adapter-example/tree/main/packages/adapter-example"
```

Or spell out each part:

```yaml
adapters:
  example:
    source: git
    repository: your-org/dsui-adapter-example
    ref: v1.2.0
    path: packages/adapter-example
```

Nothing is loaded implicitly. With no `adapters:` section DSUI starts with an
empty adapter registry.

```bash
DSUI_CONFIG=./dsui.yaml bun run --filter @northgraindata/dsui-server start
```

## Test it

```bash
bun run --filter @northgraindata/dsui-adapter-example test
bun run --filter @northgraindata/dsui-adapter-example typecheck
```

## What an adapter needs

A `package.json` and `src/adapter.ts`. Declare `@northgraindata/dsui-adapter-sdk`
as a dependency with any range; DSUI rewrites `workspace:` and `file:` ranges
onto the SDK it ships, so a monorepo adapter and a standalone one resolve the
same SDK. Ordinary npm dependencies are installed from the registry.

Native dependencies work without extra configuration: a package that ships a
platform binary is kept out of the bundle and loaded at runtime for the
platform DSUI is running on.

## Trust

Building an adapter runs a package manager and a bundler over its source.
Lifecycle scripts are disabled, and downloads are restricted to allowlisted
HTTPS hosts, but the adapter build is not sandboxed. Treat an adapter as
trusted third-party server code, and review its source before configuring it.
