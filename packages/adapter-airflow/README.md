# DSUI Airflow adapter

Server-side DSUI adapter for Apache Airflow 2.10.x and 3.x. It uses each major
version's stable public REST API: `/api/v1` for Airflow 2 and `/api/v2` for
Airflow 3.

## Connection

Configure Airflow 3 with the deployment URL and a JWT access token:

```yaml
services:
  - id: airflow-production
    adapter: airflow
    connection:
      method: airflow
      baseUrl: https://airflow.example.com
      token: ${AIRFLOW_ACCESS_TOKEN}
```

Obtain the token from the `/auth/token` endpoint supplied by the deployment's
Airflow auth manager. The adapter sends it only as a bearer authorization header.
Expired or unauthorized tokens surface as a sanitized HTTP 401/403 error; this
initial version does not acquire or refresh tokens.

Configure Airflow 2.10 with a deployment URL and credentials for its Basic auth
API backend:

```yaml
services:
  - id: airflow-legacy
    adapter: airflow
    connection:
      method: airflow-2
      baseUrl: https://airflow.example.com
      username: ${AIRFLOW_USERNAME}
      password: ${AIRFLOW_PASSWORD}
```

The Airflow deployment must enable `airflow.api.auth.backend.basic_auth`. DSUI
does not probe API versions with credentials: the selected connection method
determines the API root and authentication scheme. Existing `method: airflow`
connections remain Airflow 3 connections.

## Capabilities

- DAG list and details
- Task dependency graph drawn from upstream task ids, laid out left to right,
  with a task inspector on click
- DAG runs and run details
- Task instances, mapped-task identity, and explicit-try logs
- Trigger, pause, and unpause DAGs
- Retry failed tasks and clear selected task instances
- Asset list, details, and recent events (Airflow 2 datasets are normalized as
  assets)

Read collections are capped at 100 records per execution. Task logs request full
content for one explicit try and map index. Mutations are never automatically
retried because a timeout does not establish whether Airflow applied the change.
Airflow 2 cannot safely clear only one mapped task index through its stable API,
so retry/clear rejects that case instead of broadening the mutation to every
mapped instance of the task.

## Development

```sh
bun run --filter @northgraindata/dsui-adapter-airflow test
bun run --filter @northgraindata/dsui-adapter-airflow typecheck
```

Tests inject a fresh stateful test double (`test/fake-airflow.ts`). The adapter
itself ships no fixture mode: a real deployment is the only data source.

## Trying it against a real Airflow

The gitignored `airflow-test/` and `airflow2-test/` directories at the repository
root run Airflow 3 and Airflow 2.10.5 respectively. Each includes demo DAGs, a
DSUI service configuration, credentials, and an adapter smoke test; see the
directory's README for its local commands.
