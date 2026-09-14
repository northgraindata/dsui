# Table client controls

The adapter SDK's `Table` component accepts optional `searchable`, `filters`,
and `pageSize` properties. They are serialized browser-safe descriptions and
the renderer owns their interaction state.

The controls operate on the resource rows already fetched by an adapter. They
do not alter resource inputs or make adapter authors implement browser state.
This keeps the existing resource contract intact and makes the feature
backward-compatible for every adapter.

Adapters opt in only where a dense list benefits from it. Server-side query
parameters remain the responsibility of an adapter client when a service
requires exhaustive pagination beyond its fetched result set.
