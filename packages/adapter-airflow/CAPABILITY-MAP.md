# Capability Map: Airflow Adapter

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| `airflow-client` | Airflow 3 authentication, HTTP transport, response validation, pagination, and errors | — |
| `dag-catalog` | DAG list, DAG details, tasks, and dependency graph data | `airflow-client` |
| `dag-runs` | DAG run list/details, task instances, and task logs | `airflow-client` |
| `dag-operations` | Trigger, pause, and unpause DAGs | `dag-catalog`, `dag-runs` |
| `task-operations` | Retry and clear task instances | `dag-runs` |
| `assets` | Asset list, details, and recent events | `airflow-client` |
| `adapter-composition` | SDK resources, actions, pages, fake client, package wiring, and behavior tests | all modules |

Build order: `airflow-client` → `dag-catalog`, `dag-runs`, `assets` →
`dag-operations`, `task-operations` → `adapter-composition`.

## Approved constraints

- Target Airflow 3.x's stable public REST API at `/api/v2`.
- Authenticate with a caller-provided bearer JWT.
- Bound list requests to 100 records per resource execution.
- Present the DAG graph as a task dependency table because the current SDK has
  no graph node or browser wire contract.
- Retry clears only failed instances for the selected task and DAG run; clear
  clears the selected task regardless of state. Both reset the DAG run.
- Assets include the asset list, asset details, and recent asset events.

