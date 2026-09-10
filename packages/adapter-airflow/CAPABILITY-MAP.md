# Capability Map: Airflow Adapter

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| `airflow-client` | Version-aware Airflow 2.10 and 3 authentication, HTTP transport, response validation, pagination, and errors | — |
| `airflow-connection-choice` | Add-service choices for Airflow 2 basic authentication and Airflow 3 bearer authentication, with compatibility for saved Airflow 3 services | `airflow-client` |
| `dag-catalog` | DAG list, DAG details, tasks, and dependency graph data | `airflow-client` |
| `dag-runs` | DAG run list/details, task instances, and task logs | `airflow-client` |
| `dag-operations` | Trigger, pause, and unpause DAGs | `dag-catalog`, `dag-runs` |
| `task-operations` | Retry and clear task instances | `dag-runs` |
| `assets` | Asset list, details, and recent events | `airflow-client` |
| `adapter-composition` | SDK resources, actions, pages, fake client, package wiring, and behavior tests | all modules |
| `action-presentation` | Shared semantic action icons in the SDK-to-browser page contract and polished Airflow action layouts | `adapter-composition` |
| `live-run-graph` | Open a triggered run as a dependency graph and refresh task-instance states while it executes | `dag-catalog`, `dag-runs`, `dag-operations`, `adapter-composition` |

Build order: `airflow-client` → `airflow-connection-choice` → `dag-catalog`,
`dag-runs`, `assets` → `dag-operations`, `task-operations` →
`adapter-composition` → `action-presentation`, `live-run-graph`.

## Approved constraints

- Keep existing `airflow` connections as Airflow 3.x, using the stable public
  REST API at `/api/v2` and a caller-provided bearer JWT.
- Add Airflow 2.10.x through its stable public REST API at `/api/v1`, using
  caller-provided basic-auth credentials. Earlier 2.x releases are not claimed
  because mapped-task and dataset capabilities vary across the major line.
- Map Airflow 2 datasets into the adapter's existing asset domain so page and
  resource identities stay stable across Airflow versions.
- Bound list requests to 100 records per resource execution.
- Present the DAG graph through the SDK's dependency-graph node and browser
  renderer contract.
- Retry clears only failed instances for the selected task and DAG run; clear
  clears the selected task regardless of state. Both reset the DAG run.
- Assets include the asset list, asset details, and recent asset events.
- Action icons are semantic, allowlisted protocol values rendered by dsui; the
  adapter never supplies SVG, markup, CSS, or browser code.
- A successful manual trigger opens the run returned by Airflow. Its graph
  refreshes from bounded resource requests and renders task state as text and
  a semantic visual treatment; a trigger response is not treated as run success.
