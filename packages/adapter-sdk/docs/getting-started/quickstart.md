---
title: Quickstart
description: Define a minimal adapter in one file and verify it with a test.
---

# Quickstart

This page takes you from an empty file to a tested adapter. It uses no
client and no state, so you can focus on the shape. Later guides add
each piece.

## Write the adapter

Create one file that exports a `defineAdapter` result:

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

Three things happened in those lines. The metadata block declares the
adapter identity: a kebab-case id, a display name, and a SemVer
version. `definePage` declares a route at `/` with a render function.
`PageHeader` describes a title without any markup. Nothing here fetches
data or touches the network.

`defineAdapter` checks your work immediately. A bad id, a missing
name, a non-SemVer version, or a duplicate store, resource, action, or
page id throws `InvalidDefinitionError` at definition time. You find
out in your editor or test run, not in production.

## Prove it renders

Adapters are plain modules, so tests boot them directly.
`createAdapterInstance` validates the configuration, builds the
context, and prepares stores. A page scope resolves a URL and renders
the component tree:

```ts title="hello/adapter.test.ts"
import { expect, test } from "bun:test";
import { createAdapterInstance } from "@northgraindata/dsui-adapter-sdk";
import adapter from "./adapter";

test("hello renders", async () => {
  const instance = await createAdapterInstance(adapter, {});
  const scope = instance.createPageScope("/");
  expect(scope.render()).toEqual([
    { kind: "page-header", props: { title: "Hello" } },
  ]);
  await instance.dispose();
});
```

Run it:

```bash
bun test
```

The render output is data, not HTML. `{ kind: "page-header", ... }`
says what should appear. DSUI renderers turn it into pixels. This
matters for testing: you can assert whole pages without a browser.

Disposal matters too. `instance.dispose()` stops polling, destroys
stores, and disposes the context. Tests that skip it leak timers
across test files, so make disposal a habit from the first test.

## Add a client next

A real adapter needs a client. That means a `context()` factory plus a
connection schema, which the [context guide](../guides/context)
covers. After that, [resources](../guides/resources) add data and
[actions](../guides/actions) add behavior.

## What to read next

- [Mental model](../concepts/mental-model) for what each primitive means
- [Context](../guides/context) to connect a real client
