---
title: Snowflake adapter
description: The complete reference adapter — context, stores, resources, actions, and pages walked end to end.
---

# Snowflake adapter

`packages/adapter-snowflake/src/` is the worked reference: 40 resources,
24 actions, 28 pages, all tested against an in-memory client with
production SQL beside it. Read it in this order.

## Context and clients

`context.ts` declares `SnowflakeClient` (every operation the adapter
needs) and `SnowflakeContext` (client plus validated config — never UI
state). Two implementations:

- `fake-client.ts` — in-memory, seeded, per-call isolated state. Tests
  and local development run against this.
- `sql-client.ts` — the production Snowflake SQL API client. Swap one
  line in `adapter.ts` to use it with real credentials.

New operations start here: extend the interface, implement both
clients, then add resources on top.

## State: three stores

- `stores/session.ts` — adapter-scoped: role, secondary roles,
  warehouse, database, schema.
- `stores/query-filters.ts` — page-scoped warehouse/status/search
  filters driving the history table.
- `stores/query-editor.ts` — page-scoped SQL, tab, and tracked query id.
- `stores/log-filters.ts` — page-scoped log search and level.

## Data: resources by domain

`resources/` mirrors the product surface: `databases.ts` (databases,
schemas, tables, columns, previews, details, DDL, views, sequences),
`warehouses.ts` (5s polling), `queries.ts` (10s polling, details,
results), `tasks.ts`, `logs.ts`, `governance.ts`, `ingestion.ts`
(stages, streams, copy history, dynamic tables, pipes), `routines.ts`,
`cost.ts`, `compute.ts`, `admin.ts`.

## Behavior: actions with invalidation

`actions/` follows the same split. Every mutation ends with a scoped
`ctx.invalidate(...)` — warehouses after suspend/resume/resize/create,
tasks after run/suspend/resume, users and grants after their mutations.
Long-running work (`runQuery`, `runTask`, `executeProcedure`) shares one
shape; `cancelQuery` shows cancellation.

## Composition: pages and the adapter

`pages/` turns routes into components: explorer depth
(`/databases/:database/schemas/:schema/tables/:table`), detail tabs
(overview/queries, details/results, preview/columns/DDL/loads), reactive
filter pages (`/queries`, `/logs`), form pages (warehouses, grants,
routines), and the editor (`/query`) with session inputs, conditional
Cancel, and run binding. `components/` holds the shared composites
(`SessionBar`, `QueryContextBar`). `adapter.ts` wires all 40 + 24 + 28
with identity, connection schema, and the context factory.

## Coverage ledger

`COVERAGE.md` next to the adapter tracks every map item as covered,
partial, or listed gap — including what the SDK cannot express yet
(streaming, graphs, table power features, confirmations). Consult it
before assuming a missing surface means a missing primitive.

## What to read next

- [Testing adapters](../guides/testing-adapters) for the fake-client pattern
- [TypeScript API](../reference/typescript-api) for exact signatures
