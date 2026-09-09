# Spec: DAG Operations

## Objective

Allow an authorized user to trigger a DAG and pause or unpause scheduling while
refreshing only affected resources.

## Tech Stack

SDK actions and forms over `POST /api/v2/dags/{dag_id}/dagRuns` and
`PATCH /api/v2/dags/{dag_id}`.

## Commands

- Test: `bun run --filter @northgraindata/dsui-adapter-airflow test`
- Typecheck: `bun run --filter @northgraindata/dsui-adapter-airflow typecheck`
- Root checks: `bun run check`
- Build: `bun run build`

## Project Structure

- `src/actions/dags.ts`: trigger, pause, and unpause actions.
- `src/pages/dags.ts`: action buttons and trigger form.
- `test/adapter.test.ts`: state changes and invalidation.

## Code Style

```ts
run: async ({ dagId }, ctx: AirflowActionContext) => {
  await ctx.client.setDagPaused(dagId, true, ctx.signal);
  ctx.invalidate(dags);
  ctx.invalidate(dagDetails, { dagId });
  return { dagId, isPaused: true };
}
```

## Testing Strategy

Start with failing fake-client/runtime tests. Verify action input validation,
state transition results, narrow invalidation, trigger configuration parsing,
and that provider failures become SDK error results.

## Boundaries

- Always: use `logical_date: null` for Airflow 3 manual runs and validate trigger
  configuration as a JSON object before execution.
- Ask first: automatic action retries or scheduled/backfill creation.
- Never: retry a mutation automatically or claim a trigger means run success.

## Success Criteria

- Trigger creates one manual queued run and refreshes that DAG's run list.
- Pause/unpause updates the DAG and refreshes list/details.
- Action results describe the accepted mutation without exposing credentials.

## Open Questions

None. Mutations are intentionally not automatically retryable.

