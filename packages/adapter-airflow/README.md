# DSUI Airflow adapter

Server-side DSUI adapter for Apache Airflow 3.x. It uses Airflow's stable public
REST API under `/api/v2`; Airflow 3 does not expose these operations under an
`/api/v3` prefix.

## Connection

Configure a service with the Airflow deployment URL and a JWT access token:

```yaml
services:
  - id: airflow-production
    adapter: airflow
    connection:
      baseUrl: https://airflow.example.com
      token: ${AIRFLOW_ACCESS_TOKEN}
```

Obtain the token from the `/auth/token` endpoint supplied by the deployment's
Airflow auth manager. The adapter sends it only as a bearer authorization header.
Expired or unauthorized tokens surface as a sanitized HTTP 401/403 error; this
initial version does not acquire or refresh tokens.

## Capabilities

- DAG list and details
- Task dependency graph drawn from upstream task ids, laid out left to right,
  with a task inspector on click
- DAG runs and run details
- Task instances, mapped-task identity, and explicit-try logs
- Trigger, pause, and unpause DAGs
- Retry failed tasks and clear selected task instances
- Asset list, details, and recent events

Read collections are capped at 100 records per execution. Task logs request full
content for one explicit try and map index. Mutations are never automatically
retried because a timeout does not establish whether Airflow applied the change.

## Development

```sh
bun run --filter @northgraindata/dsui-adapter-airflow test
bun run --filter @northgraindata/dsui-adapter-airflow typecheck
```

Tests inject a fresh stateful test double (`test/fake-airflow.ts`). The adapter
itself ships no fixture mode: a real deployment is the only data source.

## Trying it against a real Airflow

`airflow-test/` at the repository root runs Airflow 3 in Docker with DAGs that
exercise every capability above. It is untracked, so see its README for the
compose commands, the sign-in credentials, and how to mint an API token.
