# Spec: DAG Catalog

## Objective

Let users browse DAGs, inspect one DAG, and understand its task dependencies.
DAG graph data is represented as rows containing task id, operator, upstream
task ids, and downstream task ids.

## Tech Stack

TypeScript resources/pages from the adapter SDK over the `AirflowClient`
contract. Airflow endpoints: `GET /api/v2/dags`, `/dags/{dag_id}/details`, and
`/dags/{dag_id}/tasks`.

## Commands

- Test: `bun run --filter @northgraindata/dsui-adapter-airflow test`
- Typecheck: `bun run --filter @northgraindata/dsui-adapter-airflow typecheck`
- Root checks: `bun run check`
- Build: `bun run build`

## Project Structure

- `src/resources/dags.ts`: DAG list, details, and task graph resources.
- `src/pages/dags.ts`: list and detail routes.
- `test/adapter.test.ts`: runtime bindings and page composition.

## Code Style

```ts
export const dagDetails = defineResource({
  id: "dag-details",
  input: z.object({ dagId: z.string().min(1) }),
  query: ({ dagId }, ctx: AirflowContext) => ctx.client.getDag(dagId),
});
```

## Testing Strategy

Drive resources through a real SDK adapter instance backed by an isolated fake
client. Verify input validation, list polling, route parameter binding, encoded
row links, detail fields, and graph dependency rows.

## Boundaries

- Always: keep external data in resources and page logic declarative.
- Ask first: add a visual graph node to the SDK/renderer contract.
- Never: fetch from pages or invent graph edges absent from Airflow task data.

## Success Criteria

- `/dags` lists up to 100 DAGs and links each row to `/dags/:dagId`.
- `/dags/:dagId` has Details, Graph, and Runs tabs.
- Graph rows preserve upstream/downstream task ids from Airflow.

## Open Questions

None. A dependency table is the approved graph presentation.

