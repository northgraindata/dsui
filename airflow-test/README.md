# Local Airflow for adapter testing

A real Airflow 3 deployment with DAGs that exercise every capability of
`@northgraindata/dsui-adapter-airflow`. This folder is gitignored: it holds
throwaway credentials and is meant for local checks only.

## Start it

```sh
cd airflow-test
docker compose up -d
```

The first boot pulls the image and takes a minute or two. Airflow is ready when
this returns a version:

```sh
curl http://localhost:8080/api/v2/version
```

Open http://localhost:8080 and sign in.

## Credentials

| Field    | Value                   |
| -------- | ----------------------- |
| URL      | `http://localhost:8080` |
| Username | `admin`                 |
| Password | `admin`                 |

The adapter authenticates with a JWT rather than a password. Mint one with:

```sh
./token.sh
```

Paste that value into the **Token** field when you add an Airflow service in
dsui, with `http://localhost:8080` as the URL. Tokens last 24 hours; rerun the
script when one expires. The JWT secret is pinned in `compose.yaml`, so tokens
survive container restarts.

To run dsui with the service already configured instead of adding it by hand:

```sh
export AIRFLOW_TOKEN="$(./token.sh)"
DSUI_CONFIG="$PWD/dsui.yaml" bun run dev
```

## What the DAGs cover

| DAG                  | Exercises                                                          |
| -------------------- | ------------------------------------------------------------------ |
| `warehouse_daily`    | Branching dependency graph, mixed operators, produces an asset      |
| `orders_report`      | Asset-scheduled run, so asset events and consuming DAGs are populated |
| `partition_backfill` | Dynamic task mapping, so task instances carry map indexes 0-3       |
| `flaky_ingest`       | A task that always fails, for retry, clear, and multi-try logs      |
| `legacy_export`      | Starts paused, for the pause and unpause actions                    |

`warehouse_daily`, `partition_backfill`, and `flaky_ingest` backfill a few runs
on first boot, so runs, task instances, and logs exist immediately.

## Check the adapter against it

```sh
cd .. && bun airflow-test/verify-adapter.ts
```

This calls every `AirflowClient` method against the running instance and prints
a line per call. It is the fastest way to catch a response shape that Airflow
changed.

## Reset or stop

```sh
docker compose down        # stop, keep history
docker compose down -v     # stop and wipe the Airflow database
```
