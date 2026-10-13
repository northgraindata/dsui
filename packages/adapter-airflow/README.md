![DSUI Apache Airflow adapter — Orchestrate and inspect your DAGs.](./assets/banner.png)

[Adapter SDK](../adapter-sdk) · [Source](./src/adapter.ts) · [DSUI](../../README.md)

# Apache Airflow adapter

Inspect DAGs, runs, task instances and logs from DSUI. Trigger runs, pause DAGs and manage Airflow connections, variables and pools.

Package: `@northgraindata/dsui-adapter-airflow`. This is currently a private workspace package.

## Capabilities

- Browse DAG definitions, task graphs and source.
- Inspect runs, task states and logs; trigger, terminate or retry work.
- Explore assets, connections, variables, pools and event logs.

## Configure

This example uses the local adapter source from a repository checkout. Run DSUI from the repository root for these relative paths, or use absolute paths for your deployment.

```yaml
adapters:
  airflow:
    source: local
    path: ./packages/adapter-airflow

services:
  - id: airflow-example
    adapter: airflow
    name: Apache Airflow
    connection:
      method: airflow
      baseUrl: http://localhost:8080
      username: admin
      password: "${AIRFLOW_PASSWORD}"
```

Secret placeholders are expanded from the DSUI process environment.

## Connection notes

- Airflow 3 uses `method: airflow`; Airflow 2.10 uses `method: airflow-2`.
- The Airflow endpoint must be reachable from the DSUI process.
- Available operations depend on the Airflow version and the account permissions.

See the [connection definitions](./src/context.ts) and [adapter registration](./src/adapter.ts) for the complete current contract.

## Development

Run from the repository root after installing dependencies:

```sh
bun run --filter @northgraindata/dsui-adapter-airflow test
bun run --filter @northgraindata/dsui-adapter-airflow typecheck
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for repository checks.

## License

[Apache License 2.0](../../LICENSE), developed by [Northgrain Data](https://northgraindata.com).
