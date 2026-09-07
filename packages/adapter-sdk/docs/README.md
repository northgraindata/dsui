---
title: DSUI Adapter SDK
description: Build data stack adapters from resources, stores, actions, pages, and DSUI components.
---

# DSUI Adapter SDK

An adapter is a small TypeScript program that runs inside the DSUI
runtime. You declare what exists in the external system. DSUI handles
execution, refreshing, and rendering. The split is deliberate: adapter
code never fetches on its own timers, never manages subscriptions, and
never writes markup.

Six concepts cover everything:

| Concept | Meaning | Constructor |
| ------- | ------- | ----------- |
| Resource | External data, managed by the runtime | `defineResource` |
| Store | Local, session, and UI state | `defineStore` |
| Action | Commands, mutations, side effects | `defineAction` |
| Page | Routes that compose components | `definePage` |
| Context | Per-instance runtime dependencies | `context()` factory |
| Adapter | The composition root | `defineAdapter` |

Two rules keep the concepts apart. External data always lives in
resources, never in stores. Behavior always lives in actions, never in
components. When a piece of code is hard to place, one of these rules
usually decides it.

Calling a resource or an action never executes anything. It creates a
binding: a plain description of intent plus validated input. The
runtime owns what happens next. It runs queries, tracks loading and
errors, polls while anyone watches, and cleans up when nobody does.

```ts title="hello/adapter.ts"
import { defineAdapter, definePage, PageHeader } from "@northgraindata/dsui-adapter-sdk";

export default defineAdapter({
  metadata: { id: "hello", name: "Hello", version: "1.0.0" },
  pages: [
    definePage({
      path: "/",
      render: () => [PageHeader({ title: "Hello" })],
    }),
  ],
});
```

This is a complete adapter. It has no client and no state, but it
boots, validates, and renders. Real adapters add a context factory for
the client, stores for state, resources for data, and actions for
behavior. The shape stays the same from one file to forty.

## Map

Start here:

- [Quickstart](./getting-started/quickstart)

Learn the ideas:

- [Mental model](./concepts/mental-model)
- [Bindings and execution](./concepts/bindings-and-execution)
- [Instances and isolation](./concepts/instances-and-isolation)
- [Refresh and lifecycle](./concepts/refresh-and-lifecycle)

Build with the guides:

- [Resources](./guides/resources)
- [Stores](./guides/stores)
- [Actions](./guides/actions)
- [Pages](./guides/pages)
- [Components](./guides/components)
- [Context](./guides/context)
- [Metadata and icons](./guides/metadata-and-icons)
- [Testing adapters](./guides/testing-adapters)

Look things up:

- [TypeScript API](./reference/typescript-api)

See it all working:

- [Snowflake adapter](./examples/snowflake)

## What to read next

- [Quickstart](./getting-started/quickstart) to ship a first adapter today
- [Mental model](./concepts/mental-model) for the ideas behind the API
