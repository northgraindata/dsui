# Spec: ClickHouse Schema Explorer

## Objective

Deliver the core CH-UI-style workflow: browse databases and objects in a tree,
open a table, and inspect useful details without writing SQL. The table
workspace contains Overview, Columns, Data, DDL, and Parts tabs. A realistic
ClickHouse mock makes the entire flow reviewable without a live cluster.

## Tech Stack

The existing ClickHouse HTTP adapter, Zod validation, declarative core views,
Hono operation endpoint, React 19, TanStack Router, and existing dsui UI
primitives. No new runtime dependency.

## Commands

- Adapter tests: `bun test packages/adapter-clickhouse/test/adapter.test.ts`
- Web tests: `bun --cwd apps/web test`
- Server tests: `bun --cwd packages/server test`
- Typecheck: `bun run typecheck`
- Lint: `bun run lint`
- Full tests: `bun run test`
- Build: `bun run build`

## Project Structure

- `packages/adapter-clickhouse/src` — bounded explorer operations and schemas
- `packages/adapter-clickhouse/test` — SQL routing and parameter tests
- `packages/adapter-mock/src` — realistic ClickHouse explorer fixtures
- `packages/core/src` — additive master/detail navigation contract
- `packages/server/src` — manifest transport only
- `apps/web/src` — generic explorer tree and table workspace renderers

## Code Style

Inputs are validated once and identifiers use ClickHouse typed parameters:

```ts
const input = z.object({
  database: z.string().min(1),
  table: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
```

## Testing Strategy

- RED/GREEN adapter tests for databases, objects, details, preview, DDL, parts,
  pagination, and malicious identifier inputs.
- Pure UI tests for tree construction and object-route selection.
- Server manifest tests for navigation metadata.
- Runtime browser verification against the ClickHouse realistic mock.

## Boundaries

- Always: cap preview at 1000 rows, preserve cancellation, and parameterize
  database/table identifiers.
- Ask first: destructive schema actions or file upload.
- Never: load an unbounded table, interpolate identifiers, expose credentials,
  or copy CH-UI source/licensed modules.

## Success Criteria

- Databases expand lazily into tables, views, dictionaries, and materialized
  views with search and clear loading/error/empty states.
- Opening a table creates a direct, reload-safe object route.
- Overview shows engine, keys, row/byte estimates, comment, and host metadata.
- Columns show names, types, defaults, codecs, TTL, and comments.
- Data shows a paginated preview with 100 rows by default and 1000 maximum.
- DDL shows the complete `CREATE TABLE` statement in copyable code.
- Parts shows active-part size, rows, marks, partition, disk, and modification
  time with bounded pagination.
- The realistic ClickHouse mock supplies meaningful data for every tab.

## Open Questions

None for the first milestone. Schema mutations and upload belong to
`clickhouse-schema-admin`.
