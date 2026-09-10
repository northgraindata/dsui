# Spec: Live Run Graph

## Objective

When a user triggers an Airflow DAG from either the DAG list or detail page,
open the newly created run with its graph visible. Show every task in dependency
order and refresh task-instance states so queued, running, success, failed, and
other Airflow states remain visible throughout the run.

## Tech Stack

Use the existing adapter SDK page protocol, Airflow resources, React renderer,
and Bun tests. Add no dependency and no Airflow-specific branch to the browser.

## Commands

- Focused tests: `bun run --filter @northgraindata/dsui-adapter-sdk test`,
  `bun run --filter @northgraindata/dsui-renderer test`, and
  `bun run --filter @northgraindata/dsui-adapter-airflow test`
- Focused typechecks: the matching package `typecheck` scripts
- Root checks: `bun run check`
- Build: `bun run build`

## Project Structure

- `packages/core`: additive browser-safe page fields for resource refresh,
  post-action links, and graph state.
- `packages/adapter-sdk`: authoring types and serialization of those fields.
- `packages/renderer`: action-result link resolution, bounded polling, and
  accessible graph-state presentation.
- `packages/adapter-airflow`: a task-instance graph resource and run-first page.

## Code Style

```ts
DependencyGraph({
  source: taskInstanceGraph({ dagId, dagRunId }),
  idField: "graphId",
  dependsOnField: "upstreamGraphIds",
  stateField: "state",
});
```

Adapters declare data and navigation. The renderer owns timers, graph layout,
state visuals, cleanup, and URL encoding.

## Testing Strategy

Start with failing contract tests for serialized refresh/navigation/state data,
pure renderer tests for state parsing and link substitution, and adapter tests
for graph topology and the triggered-run destination. Run focused tests after
each slice, then root checks and the build.

## Boundaries

- Always: stop polling on unmount, wait one interval after each completed
  request, preserve the last good graph during refresh, and show state as text.
- Ask first: WebSockets/SSE, background monitoring after leaving the run page,
  or automatic retries of the trigger mutation.
- Never: infer run success from a successful trigger, leak provider-specific
  state logic into `apps/web`, or create unbounded concurrent requests.

## Success Criteria

- Triggering from the list or DAG detail opens the exact returned run.
- The run page opens on a graph containing all DAG tasks and their dependencies.
- Task nodes visibly distinguish and label states such as queued, running,
  success, and failed.
- The graph refreshes according to the resource's declared polling interval and
  stops refreshing when it is no longer mounted.
- Existing run details, task table, and task drill-down remain available.

## Open Questions

None. This slice uses polling because it is already the SDK refresh contract;
streaming transport remains outside scope.
