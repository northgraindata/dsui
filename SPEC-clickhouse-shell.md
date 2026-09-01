# Spec: ClickHouse Workspace Shell

## Objective

Replace the flat ClickHouse capability menu with a dense, object-oriented
workspace. A user must be able to move between Explorer, Query, Operations,
Insights, Governance, and Administration without seeing every operation as a
top-level page. Existing adapter URLs remain valid during migration.

## Tech Stack

React 19, TanStack Router, TypeScript, Tailwind, the existing dsui UI tokens,
Hono manifest API, and the additive adapter capability contract.

## Commands

- Focused tests: `bun --cwd apps/web test`
- Typecheck: `bun run typecheck`
- Lint: `bun run lint`
- Full tests: `bun run test`
- Build: `bun run build`

## Project Structure

- `packages/core/src` — optional declarative navigation metadata
- `packages/server/src` — manifest serialization
- `apps/web/src` — route state and workspace presentation
- `packages/adapter-clickhouse/src` — ClickHouse navigation declarations
- `apps/web/src/*.test.ts` — pure navigation and API normalization tests

## Code Style

Navigation is derived from manifest data, never adapter-specific browser code:

```ts
view.navigation = {
  area: { id: "explorer", label: "Explorer" },
  parent: { capability: "databases" },
};
```

The metadata is optional. Adapters without it preserve their current flat
navigation.

## Testing Strategy

- Unit-test grouping, default-route selection, and unknown/missing metadata.
- Integration-test manifest serialization.
- Browser-test direct URLs, back/forward navigation, keyboard focus, and mobile
  layout once the shell renders.

## Boundaries

- Always: preserve existing capability URLs and adapter authorization.
- Ask first: adding dependencies or changing the global app navigation.
- Never: put ClickHouse-specific conditionals or credentials in browser code.

## Success Criteria

- ClickHouse has six compact top-level workspace areas, not 41 navigation rows.
- The selected area and object are represented in the URL and survive reload.
- Existing adapters without navigation metadata behave exactly as before.
- Navigation is keyboard accessible and usable at 320 px and desktop widths.

## Open Questions

None for the first milestone.
