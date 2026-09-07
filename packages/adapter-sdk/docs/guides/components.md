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

Static `data` props exist on `Table` and `KeyValue` as escape hatches
for fixed content. External data always goes through `source`
bindings, because only bindings get execution, refresh, and
invalidation.

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

`defineComponent` names a composite of builtins for reuse across
pages. It carries no browser code and needs no renderer changes:

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

## What to read next

- [Pages](./pages) for composing nodes into routes
- [Actions](./actions) for binding behavior to buttons and forms
