# Local Airflow 2 for adapter testing

A gitignored Airflow 2.10.5 deployment with DAGs that exercise the Airflow 2
path in `@northgraindata/dsui-adapter-airflow`. It runs on port 8081, so it can
coexist with the Airflow 3 demo on port 8080.

## Start it

```sh
cd airflow2-test
docker compose up -d
```

Wait until the container is healthy, then open http://localhost:8081.

## Adapter credentials

| Field | Value |
| --- | --- |
| Connection method | `airflow-2` |
| URL | `http://localhost:8081` |
| Username | `admin` |
| Password | `admin` |

The deployment enables Airflow's Basic-auth API backend. No token is required.

To run DSUI with the included service configuration:

```sh
export AIRFLOW_USERNAME=admin
export AIRFLOW_PASSWORD=admin
DSUI_CONFIG="$PWD/dsui.yaml" bun run dev
```

## Demo coverage

- `warehouse_daily`: dependency graph, mixed operators, runs, logs, and a dataset event
- `orders_report`: dataset-scheduled consumer and a second produced dataset
- `partition_backfill`: dynamic task mapping with map indexes
- `flaky_ingest`: failed task with retries and logs
- `legacy_export`: paused DAG for trigger, pause, unpause, retry, and clear actions

Run the adapter smoke test from the repository root:

```sh
bun airflow2-test/verify-adapter.ts
```

Stop or reset the environment with:

```sh
docker compose down
docker compose down -v
```

This demo intentionally targets 2.10.5. Airflow 2.2 predates datasets and
dynamic task mapping, so it cannot provide the adapter's full demo surface.
