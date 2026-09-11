# Airflow 2 integration fixture

This is a real, isolated Airflow 2.10.5 project for exercising the Airflow
adapter against the stable `/api/v1` API. It runs Airflow with PostgreSQL, the
scheduler, triggerer, webserver, and a real DAG.

Requirements: Docker with Compose v2.

```sh
docker compose -f data/airflow-v2/docker-compose.yml up airflow-init
docker compose -f data/airflow-v2/docker-compose.yml up -d
```

Open `http://localhost:8082` with `airflow` / `airflow`. Use the same values in
the dsui connection form. Stop and remove the local database with:

```sh
docker compose -f data/airflow-v2/docker-compose.yml down -v
```

The `orders_pipeline` DAG includes a mapped task, task logs, a manually
triggerable run, and a Dataset outlet so DAG, run, task, log, action, and asset
adapter paths can be exercised against a real Airflow deployment.
