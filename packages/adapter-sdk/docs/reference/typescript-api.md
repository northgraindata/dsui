---
title: TypeScript API
description: Every SDK export — definitions, factories, components, runtime, and errors.
---

# TypeScript API

Complete surface of `@northgraindata/dsui-adapter-sdk`. For behavior,
follow the links into the guides; for hover docs, read TSDoc in source
(`packages/adapter-sdk/src/<concept>/`). Anything missing here is a bug
— the list is checked against `public-api.test.ts`.

## Adapter

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `defineAdapter(options)` | function | Composition root for one system. [Guide](../guides/context) |
| `AdapterDefinition` | type | Identity, context factory, member lists. |
| `AdapterInfo` | type | `{ id, name, version, author?, iconUrl?, description? }`. [Guide](../guides/metadata-and-icons) |
| `DefineAdapterOptions` | type | Options accepted by `defineAdapter`. |
| `ADAPTER_SDK_VERSION` | const | `"0.2.0"`; recorded on every definition. |

## Resources

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `defineResource(options)` | function | Inputless or Zod-input overloads. [Guide](../guides/resources) |
| `ResourceDefinition` | type | Id, schema, query, refresh strategy. |
| `ResourceBinding` | type | Validated intent; never executes on creation. |
| `InputResource` / `InputlessResource` | types | Callable definition shapes. |
| `DataSource` | type | Structural view accepted by components. |
| `AnyResourceDefinition` | type | Heterogeneous collections, invalidation targets. |

## Refresh

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `poll(interval)` | function | `"500ms"`/`"5s"`/`"2m"`/ms → poll descriptor. |
| `manual()` | function | Fetch-on-mount descriptor (the default). |
| `RefreshPolicy` | abstract class | `start(reload)` / `stop()` lifecycle. |
| `PollingRefreshPolicy` | class | Interval reloading; unref'd timers. |
| `ManualRefreshPolicy` | class | No background work. |
| `RefreshStrategy` / `PollInterval` | types | Serializable descriptors and shorthand. |

## Stores

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `defineStore(options)` | function | Id, scope, state, actions factory. [Guide](../guides/stores) |
| `createStoreInstance(def)` | function | Isolated instance (runtime use). |
| `StoreDefinition` / `StoreInstance` | types | Contract and live handle. |
| `StoreHelpers` / `StoreScope` / `AnyStoreDefinition` | types | Action helpers, lifetimes, subsets. |

## Actions

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `defineAction(options)` | function | Inputless or Zod-input overloads. [Guide](../guides/actions) |
| `ActionDefinition` / `ActionBinding` | types | Contract and validated intent. |
| `InputAction` / `InputlessAction` | types | Callable definition shapes. |
| `ActionResult` / `ActionSuccess` / `ActionFailure` | types | Outcome unions. |
| `ActionExecutionStatus` | type | `idle \| running \| success \| error`. |
| `ActionRuntimeContext` | type | `invalidate` helper shape; annotate with `&`. |
| `ActionTarget` / `AnyActionDefinition` | types | Component view, heterogeneous subsets. |

## Pages

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `definePage(options)` | function | Path, stores, render. [Guide](../guides/pages) |
| `matchRoute(path, url)` | function | Pattern match → params or `null`. |
| `AnyPageDefinition` | type | Storage shape with literal path preserved. |
| `PageRenderContext` / `StoreAccessor` | types | Render args; `use`/`get`. |
| `ExtractRouteParams` | type | Path-to-params inference. |

## Components

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `PageHeader` / `Table` / `Button` | functions | Header, data grid, action button; actions may navigate from successful result fields. |
| `DependencyGraph` | function | Dependency layout with optional detail, state, and row-link fields. |
| `Tabs` / `KeyValue` | functions | Grouped content, record details. |
| `CodeEditor` / `Select` / `TextInput` | functions | Store-bound inputs. |
| `Form` | function | Schema-shared submit form. |
| `defineComponent(options)` | function | Common definition mechanism for shared factories, adapter composites, and browser custom components. |
| `ComponentNode` + `*Node` / `*Props` | types | Discriminated union and props. |

## Runtime

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `createAdapterInstance(def, config?)` | function | Validate, build context, wire the instance. |
| `AdapterInstance` | type | Instance contract. |
| `PageScope` | type | Render-scope contract. |
| `ResourceResult` / `ResourceSuccess` / `ResourceFailure` | types | Outcome unions. |
| `ResourceStatus` | type | Internal lifecycle states. |
| `ActionExecutionOptions` | type | `{ signal? }`. |
| `resourceKey` / `stableStringify` | functions | Execution identity helpers. |

The collaborators behind the instance (`AdapterRuntime`,
`ResourceExecutor`, `ActionExecutor`, `StoreRegistry`) live in
`src/runtime/` for readability but are intentionally not root exports:
adapters program against `AdapterInstance`, never its parts.

## Errors

| Export | Kind | Description |
| ------ | ---- | ----------- |
| `SdkError` | class | Base; stable machine-readable `code`. |
| `InvalidDefinitionError` | class | `defineX` validation failures. |
| `UnknownPageError` | class | Unmatched page URLs. |

## Manifests and external sources

Server-side packaging utilities: `adapterManifestSchema`,
`AdapterManifest`, `npmAdapterSourceSchema`,
`githubAdapterSourceSchema`, `externalAdapterSourceSchema`,
`ExternalAdapterSource`, `validateExternalSource`, `ArchiveEntry`,
`validateArchiveEntries`, `verifySriSha512`, `validateManifest`.
Re-exported `z` from Zod for schemas.

## What to read next

- [Snowflake adapter](../examples/snowflake) for the worked reference
- [Testing adapters](../guides/testing-adapters) for proving behavior
