# dbt Fusion v2 fixture

Small local dbt Fusion v2 project for exercising the DSUI adapter against the
Rust Fusion engine. It deliberately mirrors the Core v1 fixture so normalized
graph, run, catalog, and documentation views can be compared across engines.

Requirements: Docker Compose and dbt Fusion 2.x. The repository's current
`dbt` binary reports `dbt-fusion 2.0.0-preview.85`.

Start PostgreSQL:

```sh
docker compose -f data/dbt-fusion-v2/docker-compose.yml up -d
```

Run from this directory:

```sh
cd data/dbt-fusion-v2
dbt seed --profiles-dir .
dbt build --profiles-dir .
dbt docs generate --profiles-dir .
```

Artifacts are written to `target/`. Keep the generated files uncommitted so
each test run exercises fresh output. The project includes seeds, staged and
mart models, tests, source metadata, docs, and meta fields.

Stop PostgreSQL with:

```sh
docker compose -f data/dbt-fusion-v2/docker-compose.yml down -v
```
