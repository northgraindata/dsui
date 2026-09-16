# dbt Core v1 fixture

Small local dbt Core project for exercising the DSUI dbt adapter against the
Python dbt v1 engine. It uses PostgreSQL so the same project can be inspected
through generated JSON artifacts and a real catalog.

Requirements: Docker Compose and dbt Core 1.x with the `dbt-postgres` adapter.

Start PostgreSQL:

```sh
docker compose -f data/dbt-core-v1/docker-compose.yml up -d
```

Run from this directory:

```sh
cd data/dbt-core-v1
/Library/Frameworks/Python.framework/Versions/3.13/bin/dbt seed --profiles-dir .
/Library/Frameworks/Python.framework/Versions/3.13/bin/dbt build --profiles-dir .
/Library/Frameworks/Python.framework/Versions/3.13/bin/dbt docs generate --profiles-dir .
```

Artifacts are written to `target/`: `manifest.json`, `catalog.json`,
`run_results.json`, and `sources.json` when source freshness is run.

The project includes a seed, models, a singular test, generic tests, a source,
and model documentation/meta fields for exercising partial artifact sets.

Stop PostgreSQL with:

```sh
docker compose -f data/dbt-core-v1/docker-compose.yml down -v
```
