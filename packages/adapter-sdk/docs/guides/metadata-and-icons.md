---
title: Metadata and icons
description: Identify adapters with validated metadata and an icon URL for listings.
---

# Metadata and icons

Metadata identifies the adapter everywhere it appears: the adapter
list, service screens, logs, error messages. `defineAdapter`
validates it immediately. A bad id, a missing name, or a non-SemVer
version throws `InvalidDefinitionError` at definition time, as do
duplicate store, resource, action, and page ids.

```ts title="snowflake/adapter.ts"
metadata: {
  id: "snowflake",
  name: "Snowflake",
  version: "1.0.0",
  author: "DSUI",
  iconUrl: "https://…",
  description: "Browse Snowflake objects, warehouses, history, and run SQL.",
},
```

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `id` | `string` | required | Kebab-case, unique. Doubles as the icon and routing convention. |
| `name` | `string` | required | Display name. Must be non-empty. |
| `version` | `string` | required | SemVer version of the adapter itself. |
| `author` | `string` | none | Publisher name. |
| `iconUrl` | `string` | none | Absolute https URL (or data URI) for listings. |
| `description` | `string` | none | One-line listing description. |

The `id` carries weight beyond display. Routes, registries, and
conventions key off it, so pick it once and keep it stable. Renaming
an adapter id later breaks stored services and deep links.

`iconUrl` needs no registry and no build step. Paste any absolute
https URL or data URI and any listing (marketplace, library, service
picker) can render it with a plain `img` tag. Renderers show a
fallback when it is missing or unreachable, so adapters without
artwork still work. The adapter author owns the URL, including
keeping it online.

The definition also records the SDK version it was built with, so a
future major can detect incompatibility instead of failing obscurely.

## What to read next

- [Quickstart](../getting-started/quickstart) for the minimal metadata shape
- [Snowflake adapter](../examples/snowflake) for a complete definition
