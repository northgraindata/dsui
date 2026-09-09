# Spec: Adapter Composition

## Objective

Ship a workspace package named `@northgraindata/dsui-adapter-airflow` that
composes all approved Airflow resources, actions, and pages using only the
public adapter SDK and defaults to the real Airflow client.

## Tech Stack

TypeScript, Bun Test, the workspace adapter SDK, and the repository's existing
Biome/Turborepo toolchain. No new dependencies.

## Commands

- Test: `bun run --filter @northgraindata/dsui-adapter-airflow test`
- Typecheck: `bun run --filter @northgraindata/dsui-adapter-airflow typecheck`
- Root checks: `bun run check`
- Build: `bun run build`

## Project Structure

- `src/adapter.ts`: composition root and default export.
- `test/fake-airflow.ts`: isolated, stateful test double implementing
  `AirflowClient`; the adapter ships no fixture connection method.
- `src/{resources,actions,pages}/`: capability slices.
- `test/{adapter,client,wiring}.test.ts`: runtime, transport, and default wiring.
- `package.json`, `tsconfig.json`: workspace package configuration.

## Code Style

```ts
export function createAirflowAdapter(
  createClient: (config: AirflowConfig) => AirflowClient = createAirflowClient,
) {
  return defineAdapter({
    metadata: { id: "airflow", name: "Airflow", version: "1.0.0" },
    context: (config) => createContext(createClient(config), config),
  });
}
```

Keep composition explicit; do not introduce registries or import another
adapter's implementation.

## Testing Strategy

Use the real SDK runtime with a fresh fake client per instance. Cover adapter
metadata and registration, page routes, resource/action bindings, mutation
invalidation, instance isolation, disposal, and default-client wiring.

## Boundaries

- Always: export the adapter through the package root, inject fakes explicitly,
  inspect the final diff, and run package plus relevant root checks.
- Ask first: change SDK/core/renderer contracts or add dependencies.
- Never: ship fixture data as the default client, put mutable state in adapter
  definitions, or bypass the resource/action authorization distinction.

## Success Criteria

- All requested capabilities are registered and reachable through pages.
- The default adapter contacts Airflow; tests inject isolated stateful fakes.
- Package tests and typecheck pass, followed by repository checks and build.
- Documentation states the Airflow 3 `/api/v2` and bearer-token requirements.

## Open Questions

None. SDK graph extensions and additional auth methods are deferred.

