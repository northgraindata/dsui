# Airflow 3 integration fixture

This is a real, isolated Airflow 3.0.6 project for exercising the Airflow
adapter against the stable `/api/v2` API. It runs Airflow with PostgreSQL, the
API server, scheduler, DAG processor, triggerer, and a real DAG.

Requirements: Docker with Compose v2.

```sh
docker compose -f data/airflow-v3/docker-compose.yml up airflow-init
docker compose -f data/airflow-v3/docker-compose.yml up -d
```

Open `http://localhost:8083`. Airflow 3's Simple Auth Manager is configured in
development mode with all users as admins. Get a JWT for the adapter with:

```sh
curl http://localhost:8083/auth/token
```

Copy the returned token into the Airflow 3 connection form. Stop and remove the
local database with:

```sh
docker compose -f data/airflow-v3/docker-compose.yml down -v
```

The `orders_pipeline` DAG includes a mapped task, task logs, a manually
triggerable run, and an Asset outlet so DAG, run, task, log, action, and asset
adapter paths can be exercised against a real Airflow deployment.
