# Spec: Assets

## Objective

Let users browse Airflow assets, open one asset, and inspect its recent events.

## Tech Stack

TypeScript SDK resources/pages over `GET /api/v2/assets`,
`/api/v2/assets/{asset_id}`, and `/api/v2/assets/events`.

## Commands

- Test: `bun run --filter @northgraindata/dsui-adapter-airflow test`
- Typecheck: `bun run --filter @northgraindata/dsui-adapter-airflow typecheck`
- Root checks: `bun run check`
- Build: `bun run build`

## Project Structure

- `src/resources/assets.ts`: asset list/details/events.
- `src/pages/assets.ts`: list and detail routes.
- `test/adapter.test.ts`: bindings and navigation.

## Code Style

```ts
export const assetEvents = defineResource({
  id: "asset-events",
  input: z.object({ assetId: z.coerce.number().int().nonnegative() }),
  query: ({ assetId }, ctx: AirflowContext) =>
    ctx.client.listAssetEvents(assetId),
});
```

## Testing Strategy

Verify pagination bounds, numeric asset-id validation, detail/event mapping,
encoded row links, malformed provider failures, and empty collections.

## Boundaries

- Always: treat asset ids as non-negative integers and bound events to 100.
- Ask first: asset materialization or queued-event deletion.
- Never: expose asset mutation endpoints as read resources.

## Success Criteria

- `/assets` lists assets and links to `/assets/:assetId`.
- Asset details render provider metadata and recent events.
- Empty collections remain explicit successful empty arrays.

## Open Questions

None. Asset mutations are outside the requested scope.

