---
title: Pages
description: Compose routes from components and bindings with inferred params and reactive stores.
---

# Pages

Pages turn URLs into component trees. They compose; they never fetch
and never implement business logic. A page reads params and stores,
builds bindings and components, and returns them. If a page file starts
calling clients directly, that logic belongs in a resource. If it
starts implementing flows, that logic belongs in actions.

## Define a page

```ts title="snowflake/pages/databases.ts"
import { definePage, PageHeader, Table } from "@northgraindata/dsui-adapter-sdk";

export const databasePage = definePage({
  path: "/databases/:database",
  render: ({ params }) => [
    PageHeader({ title: params.database }),
    Table({ source: schemas({ database: params.database }) }),
  ],
});
```

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `path` | `string` | required | Absolute route. `:segments` become typed params. |
| `stores` | `StoreDefinition[]` | `[]` | Page-scoped stores, created per scope. No duplicate ids. |
| `render` | `(ctx) => nodes` | required | Builds components from params and stores. |

Route params are inferred from the path, so
`"/databases/:database"` gives `params.database: string` and
`"/tasks/:database/:schema/:task"` gives all three. No Zod schemas
for simple string params. Static segments match literally, dynamic
ones match anything non-empty, and lengths must agree, or the URL
falls through to the next page (and eventually `UnknownPageError`).

## React to stores

Declare page-scoped stores on the page, read them with `stores.use()`,
and feed them into bindings. Updates flow through the whole chain on
their own: keystroke, store notify, re-render, new binding input,
refetch, updated table.

```ts title="snowflake/pages/queries.ts"
definePage({
  path: "/queries",
  stores: [queryFiltersStore],
  render: ({ stores }) => {
    const filters = stores.use(queryFiltersStore);
    return [Table({ source: queries({ search: filters.search }) })];
  },
});
```

Renders may also branch on state. The query editor shows Cancel only
while a query id is tracked:

```ts title="snowflake/pages/query-editor.ts"
...(editor.currentQueryId
  ? [Button({ label: "Cancel", action: cancelQuery({ queryId: editor.currentQueryId }) })]
  : []),
```

The guard is load-bearing, not stylistic. Binding creation validates,
so an unconditional `cancelQuery({ queryId: null })` would throw
during render. Whenever a binding input can be absent, branch first.

## Navigate between pages

Row clicks return deep links. Encode every dynamic segment; names
with slashes or spaces exist in real warehouses:

```ts
Table({
  source: databases(),
  onRowClick: (name) => `/databases/${encodeURIComponent(name)}`,
});
```

Detail pages compose tabs around one entity: the table page shows
Preview, Columns, Details, DDL, and Loads; the warehouse page shows
Overview plus its filtered queries; the task page shows Details, a
dependency view, and run History. The pattern repeats because the
primitives compose, not because anyone copied markup.

## Test pages without a browser

Render output is data. Create an instance, open a scope for a URL,
and assert nodes and binding inputs:

```ts
const scope = instance.createPageScope("/databases/ANALYTICS");
expect(scope.params).toEqual({ database: "ANALYTICS" });
// find the table node, check its source input, dispose the scope
```

Drive reactivity the same way: call a store action through
`scope.stores.use(...)`, re-render, and assert the new binding input.
The Snowflake suite does exactly this for filter changes and for the
conditional Cancel button.

## What to read next

- [Components](./components) for the nodes pages compose
- [Stores](./stores) for page-scoped state
