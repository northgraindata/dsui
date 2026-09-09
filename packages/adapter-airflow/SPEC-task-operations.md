# Spec: Task Operations

## Objective

Allow users to retry a failed task instance or clear a selected task instance
for one DAG run using Airflow's clear-task-instances API.

## Tech Stack

SDK actions over `POST /api/v2/dags/{dag_id}/clearTaskInstances`.

## Commands

- Test: `bun run --filter @northgraindata/dsui-adapter-airflow test`
- Typecheck: `bun run --filter @northgraindata/dsui-adapter-airflow typecheck`
- Root checks: `bun run check`
- Build: `bun run build`

## Project Structure

- `src/actions/tasks.ts`: retry and clear actions.
- `src/pages/runs.ts`: task-instance row/detail actions.
- `test/adapter.test.ts`: mutation semantics and invalidation.

## Code Style

```ts
await ctx.client.clearTaskInstances({
  dagId,
  dagRunId,
  taskIds: [taskId],
  onlyFailed: true,
  resetDagRuns: true,
});
```

## Testing Strategy

Use a stateful fake client. Verify retry rejects/non-mutates a non-failed task,
clear accepts any state, only the selected DAG/run/task changes, and affected
run/task resources refresh.

## Boundaries

- Always: set `dry_run: false`, scope by DAG run and task id, and reset the DAG
  run so scheduling can resume.
- Ask first: upstream/downstream/future/past bulk clearing.
- Never: broaden a single-row action to other task instances silently or retry
  the mutation automatically.

## Success Criteria

- Retry clears only a failed selected task.
- Clear clears the selected task regardless of state.
- Both invalidate run details, run list, and task-instance resources narrowly.

## Open Questions

None. Bulk dependency/future/past clearing is out of scope.

