![DSUI PostgreSQL adapter — Inspect databases and run SQL.](./assets/banner.png)

[Adapter SDK](../adapter-sdk) · [Source](./src/adapter.ts) · [DSUI](../../README.md)

# PostgreSQL adapter

Inspect PostgreSQL databases, schemas, relations and server activity. Run and cancel SQL queries from DSUI.

Package: `@northgraindata/dsui-adapter-postgresql`. This is currently a private workspace package.

## Capabilities

- Browse databases, schemas, relation metadata and previews.
- Run SQL and cancel active queries.
- Inspect server information and activity.

## Configure

This example uses the local adapter source from a repository checkout. Run DSUI from the repository root for these relative paths, or use absolute paths for your deployment.

```yaml
adapters:
  postgresql:
    source: local
    path: ./packages/adapter-postgresql

services:
  - id: postgresql-example
    adapter: postgresql
    name: PostgreSQL
    connection:
      method: postgresql
      host: localhost
      port: 5432
      database: analytics
      databaseScope: selected
      username: dsui
      password: "${POSTGRES_PASSWORD}"
      sslMode: prefer
```

Secret placeholders are expanded from the DSUI process environment.

## Connection notes

- `databaseScope: selected` limits browsing to the initial database; `all` is the default and includes accessible databases.
- The default port is 5432, connect timeout is 10 seconds and statement timeout is 60,000 milliseconds.
- SSL settings and optional certificate fields are defined in the [connection schema](./src/context.ts).
- SQL runs with the configured database role and can mutate data if that role permits it.

See the [connection definitions](./src/context.ts) and [adapter registration](./src/adapter.ts) for the complete current contract.

## Development

Run from the repository root after installing dependencies:

```sh
bun run --filter @northgraindata/dsui-adapter-postgresql typecheck
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for repository checks.

## License

[Apache License 2.0](../../LICENSE), developed by [Northgrain Data](https://northgraindata.com).
