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

## Load it locally

Because this package is in the monorepo workspaces, DSUI can load it
in-process by name — no npm or git publish needed.

```yaml
# dsui.yaml
adapters:
  example:
    package: "@northgraindata/dsui-adapter-example"

services:
  - id: demo
    adapter: example
    connection:
      baseUrl: http://localhost:4192
```

```bash
DSUI_CONFIG=./dsui.yaml bun run --filter @northgraindata/dsui-server start
```

A local path also works: `package: "./examples/example-adapter/src/adapter.ts"`.

## Test it

```bash
bun run --filter @northgraindata/dsui-adapter-example test
bun run --filter @northgraindata/dsui-adapter-example typecheck
```

## Releasing an adapter

A published adapter is two artifacts plus an optional browser bundle:

- `dsui.adapter.json` — the manifest.
- `dist/adapter.mjs` — one self-contained ESM bundle (no native addons,
  no code splitting).
- `dist/components.mjs` — browser bundle, only when the adapter declares
  browser components.

The manifest declares identity, the SDK version it targets, the entry
path, and the ids for resources, actions, pages, and components, plus
the byte count and SHA-256 of each bundle. See
`adapterManifestSchema` in the SDK for the exact shape.

### From npm

Publish the package, then pin it with the tarball SRI:

```yaml
adapters:
  example:
    package: "@your-org/dsui-adapter-example"
    version: "1.0.0"
    integrity: "sha512-..."   # npm dist.integrity for the tarball
```

### From git

Commit the manifest and bundle to a repository, then pin the commit and
the bundle's SRI:

```yaml
adapters:
  example:
    source: git
    repository: "git+https://github.com/your-org/dsui-adapter-example"
    commit: "<full-40-char-sha>"
    integrity: "sha384-..."   # SRI of dist/adapter.mjs
```

Both install verified and run isolated in an `adapter-host` subprocess.
Floating refs and unpinned versions are rejected.
