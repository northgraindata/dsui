![DSUI DuckDB adapter — Explore your data. Run SQL.](./assets/banner.png)

[Adapter SDK](../adapter-sdk) · [Source](./src/adapter.ts) · [DSUI](../../README.md)

# DuckDB adapter

Browse DuckDB catalogs and query data from DSUI, using an in-memory database, local database file or supported remote connection.

Package: `@northgraindata/dsui-adapter-duckdb`. This is currently a private workspace package.

## Capabilities

- Browse databases, schemas, tables, views and columns.
- Run SQL and inspect query results and history.
- Inspect storage, extensions, settings and secrets.

## Configure

This example uses the local adapter source from a repository checkout. Run DSUI from the repository root for these relative paths, or use absolute paths for your deployment.

```yaml
adapters:
  duckdb:
    source: local
    path: ./packages/adapter-duckdb

services:
  - id: duckdb-example
    adapter: duckdb
    name: DuckDB
    connection:
      method: file
      path: /data/analytics.duckdb
      readOnly: false
```

Secret placeholders are expanded from the DSUI process environment.

## Connection notes

- File paths belong to the DSUI host or container; persist the containing directory if you want data to survive container replacement.
- Use `method: memory` for an ephemeral database.
- Additional connection methods are declared in the [connection schema](./src/context.ts); remote connections can require extensions and credentials.
- Query and configuration actions can modify the database when the connection is writable.

See the [connection definitions](./src/context.ts) and [adapter registration](./src/adapter.ts) for the complete current contract.

## Development

Run from the repository root after installing dependencies:

```sh
bun run --filter @northgraindata/dsui-adapter-duckdb typecheck
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for repository checks.

## License

[Apache License 2.0](../../LICENSE), developed by [Northgrain Data](https://northgraindata.com).
