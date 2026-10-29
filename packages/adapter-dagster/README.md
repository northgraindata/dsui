# Dagster adapter

Browse Dagster assets and their direct upstream/downstream lineage, inspect
jobs, op dependencies and runs, read run events, launch jobs, and terminate
active runs from DSUI.

Package: `@northgraindata/dsui-adapter-dagster` (private workspace package).

## Configure

```yaml
adapters:
  dagster:
    source: local
    path: ../adapter-dagster

services:
  - id: dagster-local
    adapter: dagster
    name: Dagster
    connection:
      method: dagster
      baseUrl: http://127.0.0.1:3006
```

The URL is the Dagster webserver root; the adapter calls `/graphql` itself.
See [`data/dagster-test`](../../data/dagster-test/README.md) for a local instance
with sample jobs and a ready-to-use DSUI configuration.

## Connection methods

| Method | Use | Fields |
| --- | --- | --- |
| `dagster` | Open source webserver with no API authentication | `baseUrl` |
| `dagster-basic` | Self-hosted webserver behind an HTTP Basic-auth proxy | `baseUrl`, `username`, `password` |
| `dagster-plus` | Dagster+ deployment | `baseUrl`, `apiToken` |

For Dagster+, set `baseUrl` to the deployment root, for example
`https://my-org.dagster.cloud/prod`, and set `apiToken` to a **user** token.
The adapter sends it in the `Dagster-Cloud-Api-Token` header. Authenticated
connections require HTTPS except on loopback addresses.

```yaml
connection:
  method: dagster-plus
  baseUrl: https://my-org.dagster.cloud/prod
  apiToken: "${DAGSTER_PLUS_TOKEN}"
```

Dagster calls executable workflows **jobs**. An op-based job executes a graph
of **ops** with dependency edges; that graph is a DAG. Asset-based jobs execute
selected assets. There is no separate Airflow-style DAG object to connect to.

Dagster's GraphQL API is evolving. This adapter targets the documented
repository, run, launch, and termination operations of the open source
webserver. Asset views are read-only; schedules, sensors, and code locations
are not managed.
