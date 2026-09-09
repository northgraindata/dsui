# Spec: DAG Runs

## Objective

Let users inspect recent runs for a DAG, open one run, inspect task instances,
open a task instance, and read a selected try's log.

## Tech Stack

TypeScript SDK resources/pages over Airflow `/api/v2/dags/{dag_id}/dagRuns`
and nested task-instance/log endpoints.

## Commands

- Test: `bun run --filter @northgraindata/dsui-adapter-airflow test`
- Typecheck: `bun run --filter @northgraindata/dsui-adapter-airflow typecheck`
- Root checks: `bun run check`
- Build: `bun run build`

## Project Structure

- `src/resources/runs.ts`: run list/details, task instances, and task log.
- `src/pages/runs.ts`: run and task-instance detail routes.
- `test/adapter.test.ts`: bindings and navigation behavior.

## Code Style

```ts
export const taskLog = defineResource({
  id: "task-log",
  input: taskTryInput,
  query: (input, ctx: AirflowContext) => ctx.client.getTaskLog(input),
});
```

Use explicit composite inputs containing `dagId`, `dagRunId`, `taskId`,
`mapIndex`, and `tryNumber` where the endpoint requires them.

## Testing Strategy

Test valid and invalid bindings, mapped-task identifiers, polling of active run
data, route composition, exact log try selection, and JSON log response parsing.

## Boundaries

- Always: default logs to the task instance's current try in navigation data,
  preserve map indexes, and bound list resources to 100.
- Ask first: stream logs or add browser-managed pagination.
- Never: fetch all tries/log pages implicitly or discard mapped-task identity.

## Success Criteria

- DAG detail exposes recent runs and run rows deep-link to run details.
- Run details expose task instances with state and timing information.
- Task-instance detail exposes metadata and a log resource for an explicit try.

## Open Questions

None. The first release reads one explicit task-log try with full content.

