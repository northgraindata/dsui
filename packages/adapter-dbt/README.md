![DSUI dbt adapter — Explore models, runs and artifacts.](./assets/banner.png)

[Adapter SDK](../adapter-sdk) · [Source](./src/adapter.ts) · [DSUI](../../README.md)

# dbt adapter

Explore dbt projects, models, lineage, runs and artifacts. Connect a local project or a dbt Cloud account.

Package: `@northgraindata/dsui-adapter-dbt`. This is currently a private workspace package.

## Capabilities

- Browse models, sources, tests and model lineage.
- Inspect manifests, catalogs, run results and other artifacts.
- Execute local commands or trigger and cancel dbt Cloud runs.

## Configure

This example uses the local adapter source from a repository checkout. Run DSUI from the repository root for these relative paths, or use absolute paths for your deployment.

```yaml
adapters:
  dbt:
    source: local
    path: ./packages/adapter-dbt

services:
  - id: dbt-example
    adapter: dbt
    name: dbt
    connection:
      method: local
      projectPath: /home/operator/projects/analytics
      profilesDir: /home/operator/.dbt
      executable: dbt
```

Secret placeholders are expanded from the DSUI process environment.

## Connection notes

- Local mode runs the configured executable on the DSUI host. Install dbt and the appropriate database adapter, and make project/profile paths accessible to that process.
- In Docker, mount the project and profiles and supply the required runtime dependencies.
- Cloud mode uses `method: cloud` with `baseUrl`, `accountId`, `apiToken` and optional `jobId`. Capabilities vary by connection mode.

See the [connection definitions](./src/context.ts) and [adapter registration](./src/adapter.ts) for the complete current contract.

## Development

Run from the repository root after installing dependencies:

```sh
bun run --filter @northgraindata/dsui-adapter-dbt test
bun run --filter @northgraindata/dsui-adapter-dbt typecheck
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for repository checks.

## License

[Apache License 2.0](../../LICENSE), developed by [Northgrain Data](https://northgraindata.com).
