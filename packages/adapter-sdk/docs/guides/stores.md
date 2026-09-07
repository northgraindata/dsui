---
title: Stores
description: Hold local, session, and UI state in typed, scoped stores with actions and subscriptions.
---

# Stores

Stores hold everything that is not external data: the selected
warehouse, filter text, SQL being edited, the active tab, transient
wizard state. If the data came from a service, it belongs in a
[resource](./resources). If it describes where the user is or what
they typed, it belongs in a store.

## Define a store

```ts title="snowflake/stores/query-filters.ts"
import { defineStore } from "@northgraindata/dsui-adapter-sdk";

export const queryFiltersStore = defineStore({
  id: "query-filters",
  scope: "page",
  state: {
    warehouse: null as string | null,
    status: null as string | null,
    search: "",
  },
  actions: ({ set }) => ({
    setWarehouse: (warehouse: string | null) => set({ warehouse }),
    setStatus: (status: string | null) => set({ status }),
    setSearch: (search: string) => set({ search }),
  }),
});
```

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `id` | `string` | required | Unique within its scope. Must be non-empty. |
| `scope` | `"adapter" \| "page"` | required | Lifetime (below). |
| `state` | object | required | Initial state. Copied per instance. |
| `actions` | `({ get, set, reset }) => actions` | required | Typed actions closing over state helpers. |

The `actions` factory receives three helpers bound to one instance:
`get()` returns a snapshot copy, `set()` merges a partial update and
notifies subscribers, `reset()` restores the initial state. Keep
actions small and synchronous. They change state and nothing else.
Fetching, validating against a server, and side effects belong in
actions (the `defineAction` kind) or resources.

State typing deserves a sentence. `null as string | null` looks noisy,
but it records a real distinction: no selection yet versus a selected
value. Filters start unselected and become selected. The type carries
that, and pages branch on it honestly instead of using empty strings
that also mean something.

## Choose a scope

Scope answers one question: should this state survive leaving the page?

**Adapter scope** lives per adapter instance. Session role, warehouse,
database, schema. It survives navigation and dies with the instance.
Two instances never share it, so prod and dev selections stay apart.

**Page scope** lives per rendered page. Filters, editor content,
selected tabs, transient form state. Created with the page scope,
destroyed on `scope.dispose()`. Going back to the page starts fresh,
which is usually what users expect from filters and drafts.

When unsure, pick page scope. Adapter scope is for identity-like state
that the whole adapter session shares. Everything else is page state.

## Read reactively in pages

Pages read stores through the accessor. `use()` returns live state
fields merged with the store's actions, and subscribes the page so
changes re-render:

```ts title="snowflake/pages/queries.ts"
render: ({ stores }) => {
  const filters = stores.use(queryFiltersStore);
  return [Table({ source: queries({ search: filters.search }) })];
},
```

Follow the chain when a user types: keystroke calls `setSearch`, the
store notifies, the page re-renders, the binding input changes, the
watcher re-executes, the table updates. No manual wiring anywhere.
`stores.get()` reads a snapshot without subscribing, for values needed
once during render.

Inputs bind the same way. `value` shows store state, `onChange` calls
a store action:

```ts
TextInput({ name: "search", value: filters.search, onChange: filters.setSearch });
CodeEditor({ language: "sql", value: editor.sql, onChange: editor.setSql });
```

Because the view object exposes state fields as getters, `filters.search`
is always current inside a fresh render. Never cache it in a local.

## Test stores directly

Stores need no runtime. Create an instance, call actions, assert state
and notifications:

```ts
const session = createStoreInstance(sessionStore);
session.actions.setWarehouse("ETL_WH");
session.get().warehouse; // "ETL_WH"
```

Test isolation between instances, reset behavior, and destroy
semantics (writes after destroy are ignored, subscribers released).
The Snowflake suite covers all of it.

## What to read next

- [Resources](./resources) for feeding store state into resource inputs
- [Instances and isolation](../concepts/instances-and-isolation) for scope lifetimes
