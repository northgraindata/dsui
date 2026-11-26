# Page ledger

Status is one of: `todo`, `proposed`, `approved`, `changed`, `done`.
Only the maintainer moves a page to `approved` or `done`.

## Application screens

| Page | Status | Notes |
| --- | --- | --- |
| `/` | todo | |
| `/services` | todo | |
| `/services/new` | todo | |
| `/adapters/:adapterId` | todo | |
| `/settings` | todo | |

## Airflow

| Page | Status | Notes |
| --- | --- | --- |
| `/` | changed | Row triggers ask first. Open: R14 schedule badge, R19 next-run text. |
| `/dags` | changed | Row Trigger, Pause and Unpause ask first; icon buttons have tooltips; shared menu. Open: R14, R19. |
| `/dags/:dagId` | changed | Header and run actions ask first; details read as labels. Open: R14, R19. |
| `/dags/:dagId/runs/:dagRunId` | changed | Terminate and Clear task ask first; details read as labels. Open: retry confirmation, R11 graph glyphs, R19 durations. |
| `/dags/:dagId/runs/:dagRunId/tasks/:taskId/:mapIndex/:tryNumber` | changed | Details read as labels and dates follow settings. Open: duration has no unit. |
| `/assets` | todo | No change. Open: R14 group badge, R19 updated time. |
| `/assets/:assetId` | changed | Details read as labels and dates follow settings. |
| `/connections` | changed | Add and Edit are modals; Delete names the connection. Open: R14 type badge. |
| `/variables` | changed | Add and Edit are modals; Delete names the variable. Open: R14 encrypted badge. |
| `/pools` | changed | Add and Edit are modals; Delete names the pool. |
| `/users` | todo | No change. Open: R14 roles badge. |
| `/event-logs` | changed | Time follows settings; "Clear all" only when sorted or filtered. |

The `new` and `edit` pages of connections, variables and pools were removed in favour of modals.

Open points for both adapters are in [airflow-clickhouse.md](airflow-clickhouse.md).

## ClickHouse

| Page | Status | Notes |
| --- | --- | --- |
| `/` | changed | Duplicate header removed; server details read as labels. |
| `/data` | changed | Create database is a modal; "Clear all" only when useful. |
| `/data/:database` | changed | "Clear all" only when useful. |
| `/data/:database/:table` | changed | Details read as labels; "Clear all" only when useful. Preview values are left as stored. |
| `/query` | changed | Explorer no longer marks every database selected. Open: confirmation for SQL that changes data. |
| `/query/:database` | changed | Same as `/query`. |
| `/activity` | changed | Cancel query asks first and names the query. |

## Dagster

| Page | Status | Notes |
| --- | --- | --- |
| `/` | todo |  |
| `/lineage` | todo |  |
| `/assets` | todo |  |
| `/assets/:id` | todo |  |
| `/jobs` | todo |  |
| `/jobs/:repositoryLocationName/:repositoryName/:name` | todo |  |
| `/automation` | todo |  |
| `/runs` | todo |  |
| `/runs/:runId` | todo |  |

## dbt

| Page | Status | Notes |
| --- | --- | --- |
| `/` | todo |  |
| `/projects` | todo |  |
| `/jobs` | todo |  |
| `/runs` | todo |  |
| `/runs/:runId` | todo |  |
| `/artifacts` | todo |  |
| `/artifacts/:artifactName` | todo |  |
| `/models` | todo |  |
| `/models/:modelId` | todo |  |
| `/sources` | todo |  |
| `/tests` | todo |  |

## DuckDB

| Page | Status | Notes |
| --- | --- | --- |
| `/` | todo |  |
| `/data` | todo |  |
| `/data/:database` | todo |  |
| `/data/:database/:schema` | todo |  |
| `/data/:database/:schema/:relationType/:relation` | todo |  |
| `/query` | todo |  |
| `/notebooks/:notebookId` | todo |  |
| `/notebooks` | todo |  |
| `/files` | todo |  |
| `/extensions` | todo |  |
| `/extensions/:extension` | todo |  |
| `/activity` | todo |  |

## PostgreSQL

| Page | Status | Notes |
| --- | --- | --- |
| `/` | todo |  |
| `/data` | todo |  |
| `/data/:database` | todo |  |
| `/data/:database/:schema` | todo |  |
| `/data/:database/:schema/:relation` | todo |  |
| `/query` | todo |  |
| `/query/:database` | todo |  |
| `/activity` | todo |  |

## S3

| Page | Status | Notes |
| --- | --- | --- |
| `/` | todo |  |
| `/buckets/:bucket` | todo |  |

## Shaper

| Page | Status | Notes |
| --- | --- | --- |
| `/` | todo |  |
| `/dashboards` | todo |  |
| `/dashboards/new` | todo |  |
| `/dashboards/:id` | todo |  |
| `/dashboards/:id/edit` | todo |  |
| `/tasks` | todo |  |
| `/tasks/new` | todo |  |
| `/tasks/:id/edit` | todo |  |
| `/query` | todo |  |

## Snowflake

| Page | Status | Notes |
| --- | --- | --- |
| `/` | todo |  |
| `/data` | todo |  |
| `/data/:database` | todo |  |
| `/data/:database/:schema` | todo |  |
| `/data/:database/:schema/:relation` | todo |  |
| `/usage` | todo |  |
| `/warehouses` | todo |  |
| `/warehouses/:name` | todo |  |
| `/activity` | todo |  |
| `/activity/:queryId` | todo |  |
| `/query` | todo |  |
