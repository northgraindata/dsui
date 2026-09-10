---
title: Components
description: Describe UI intent with builtin factories. Tables, buttons, tabs, forms, inputs, editors.
---

# Components

Components describe intent. DSUI owns HTML, CSS, spacing, and
responsive behavior. Standard adapters never write markup, and pages
stay readable because every node says what it is, not how it looks.

Every factory returns a node: `{ kind, props }`. Pages return nodes or
arrays of them. Tabs nest them. Nothing else is required to build a
full adapter UI.

## Show data

`Table` is the workhorse. Give it a resource binding and it shows
external data. Give it row callbacks and it adapts per row. Give it an
`onRowClick` and rows become deep links:

```ts title="snowflake/pages/warehouses.ts"
Table<Warehouse>({
  source: warehouses(),
  onRowClick: (row) => `/warehouses/${encodeURIComponent(row.name)}`,
  actions: (row) =>
    row.status === "SUSPENDED"
      ? Button({ label: "Resume", action: resumeWarehouse({ warehouse: row.name }) })
      : Button({ label: "Suspend", action: suspendWarehouse({ warehouse: row.name }) }),
});
```

The generic parameter types the row callbacks, so `row.status` is
checked. The callbacks run at render time against real rows, which is
why the SDK is a TypeScript API rather than static JSON: data-driven
UI needs functions, and functions need types.

`KeyValue` shows one record, usually from a details resource. Pass a
`title` for the section. `PageHeader` titles the page with an optional
description and header actions. `Tabs` groups labeled content; it
requires at least one item, and each item holds one node or many.

`ResourceTree` describes a lazy hierarchy whose levels are backed by
resources. Child source inputs may reference fields from the selected parent row
with `$field` values. Pair it with `SplitPane` for persistent explorer/detail
pages; the renderer owns expansion, search, selection, scroll restoration, and
responsive collapse behavior.

`SplitPane` also accepts an optional `inspector` node or array of nodes. It
renders a details rail beside the content on wide screens and below it on narrow
screens. It uses the same serialization and resource bindings as `content`.
For example: `SplitPane({ sidebar: tree, content: preview, inspector: details })`.

```ts
SplitPane({
  sidebar: ResourceTree({
    label: "Data explorer",
    selectedPath: "/data/main/analytics",
    stateKey: "data-explorer",
    branch: {
      source: databases(),
      rowLink: { path: "/data/:database", params: { database: "name" } },
      children: {
        source: schemas({ database: "$name" }),
        rowLink: {
          path: "/data/:database/:schema",
          params: { database: "database", schema: "name" },
        },
      },
    },
  }),
  content: PageHeader({ title: "analytics" }),
});
```

Static `data` props exist on `Table` and `KeyValue` as escape hatches
for fixed content. External data always goes through `source`
bindings, because only bindings get execution, refresh, and
invalidation.

`DependencyGraph` renders one row per node and derives its edges from an
array field. Set `stateField` when rows carry live execution state; the renderer
shows the value as text with a semantic status treatment. A polling resource
keeps that state current while the graph is mounted:

```ts
DependencyGraph({
  source: taskRuns({ runId }),
  idField: "taskId",
  dependsOnField: "upstreamTaskIds",
  labelField: "name",
  detailField: "operator",
  stateField: "state",
});
```

Buttons and table row actions may set `successLink` to open another adapter
page using fields returned by a successful action. The path must be absolute;
the renderer URL-encodes every substituted value and stays in place when the
result lacks one of the declared fields.

```ts
Button({
  label: "Trigger",
  action: triggerDag({ dagId }),
  successLink: {
    path: "/dags/:dagId/runs/:dagRunId",
    params: { dagId: "dagId", dagRunId: "dagRunId" },
  },
});
```

## Compose overview pages

`Section` groups one panel: a heading, an optional description and
link, and nested content. `StatGrid` reads one record (like
`KeyValue`) and renders value/label cards from its fields.
`CardList` renders entity cards from card-shaped resource rows or a
static `cards` array, and `ActionList` renders quick actions with
display-only keyboard hints:

```ts title="duckdb/pages/databases.ts"
Section({
  title: "Attached databases",
  description: "Databases available in this instance.",
  link: { label: "Attach", path: "/databases" },
  content: CardList({ source: databases() }),
});
StatGrid({
  source: overviewStats(),
  items: [{ icon: "database", field: "size", label: "Database size" }],
});
ActionList({
  items: [{ icon: "play", title: "New query", link: "/query", kbd: "⌘N" }],
});
```

`PageHeader` also takes a status `badge`, a `meta` line, and header
`actions`. `Button` accepts either an `action` binding or a page
`link`; paths are absolute adapter routes in both cases. Pair panels
side by side with `Columns` (weighted columns, collapsing on narrow
screens). Fix a card grid to N columns with `CardList({ columns: 2 })`,
and show byte breakdowns with `Meter`:

```ts title="duckdb/pages/databases.ts"
Columns({
  columns: [
    { weight: 2, content: Section({ title: "Attached", content: cards }) },
    { weight: 1, content: Section({ title: "Quick", content: actions }) },
  ],
});
Meter({ source: storageMeter() });
```

## Collect input

Text inputs, selects, and the code editor bind store state directly.
`value` shows the state, `onChange` calls a store action:

```ts title="snowflake/pages/query-editor.ts"
TextInput({
  name: "warehouse",
  label: "Warehouse",
  value: session.warehouse ?? "",
  onChange: (value) => session.setWarehouse(value || null),
});
CodeEditor({ language: "sql", value: editor.sql, onChange: editor.setSql });
```

`Select` takes plain option arrays of `{ label, value }`. Populating
options from resources is renderer-owned: the page passes arrays, and
the renderer may substitute live ones. The `SessionBar` composite
shows the intended shape for option-driven selects.

`Form` ties inputs to an action through one shared Zod schema. The
runtime validates the submitted data before invoking the action, so
the form and the action can never disagree about what is valid:

```ts title="snowflake/pages/warehouses.ts"
Form({
  schema: resizeWarehouseInput,
  fields: [
    TextInput({ name: "warehouse", label: "Warehouse" }),
    Select({ name: "size", label: "Size", options: WAREHOUSE_SIZES }),
  ],
  onSubmit: resizeWarehouse,
  submitLabel: "Resize warehouse",
});
```

`onSubmit` accepts the action definition itself; the runtime binds
the validated data. Share the schema object between the action input
and the form, as the Snowflake adapter does, and the two stay in sync
by construction.

## Reuse composites

`defineComponent` is the common definition mechanism behind the standard
component factories and adapter-owned components. Adapter authors normally
import standard primitives directly; use `defineComponent` when naming a
reusable adapter composite. A render-mode component carries no browser code and
needs no renderer changes:

```ts title="snowflake/components/session-bar.ts"
export const SessionBar = defineComponent<SessionBarProps, readonly ComponentNode[]>({
  id: "session-bar",
  render: (props) => [
    Select({
      name: "role",
      label: "Role",
      value: props.role,
      options: props.roles.map((role) => ({ label: role, value: role })),
      onChange: props.onRole,
    }),
  ],
});
```

Use composites for repeated adapter chrome: session bars, context
displays, standard detail headers. One definition, every page.

## Browser components

Composites return builtin nodes evaluated on the server. When a custom
visual is genuinely needed, `defineComponent` also accepts a `path`
pointing at the tsx module (relative to the adapter package) instead
of `render`:

```ts
export const TableCard = defineComponent<{ table: string }>({
  id: "duckdb/table-card",
  path: "./components/TableCard.tsx",
});
```

Calling it returns a `"custom"` node carrying the component id and
JSON-serializable props — no browser code crosses the server boundary.
The renderer resolves the id from its component registry and
lazy-loads the module; unknown ids render an explicit fallback, never
a blank screen. Props are validated against the optional `props`
schema at authoring time, like action inputs.

Custom components compose the generic layer: import primitives and
views from the shared packages rather than reimplementing them. The
tsx must be resolvable by the host build (dev glob, prod manifest
entries), so an adapter installed after the build needs a rebuild
before its components render.

## What to read next

- [Pages](./pages) for composing nodes into routes
- [Actions](./actions) for binding behavior to buttons and forms
