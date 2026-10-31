# Dagster adapter

Explore Dagster asset lineage as a graph framed by group and tagged with each
asset's kinds, inspect assets, checks, jobs, and runs, materialize assets,
launch and terminate runs, and start or stop schedules and sensors from DSUI.

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
repository, asset, run, launch, termination, schedule, and sensor operations
of the open source webserver. Runs launch with an empty run configuration,
and code locations are not managed.

## Kind icons

The lineage graph shows Dagster's own icon for each asset kind, matched by
the same rule as Dagster's UI (case, spaces, `_`, `.`, and `-` are ignored).
The icons and their labels are generated into
`src/components/kind-icons.generated.ts` from a pinned commit of
[dagster-io/dagster](https://github.com/dagster-io/dagster); icons larger
than 16 KB are left out to keep the browser bundle small, and those kinds fall
back to a coloured glyph. To update, run from the repository root:

```sh
bun run --cwd packages/adapter-dagster sync:kind-icons [commit]
```

The icon files are Copyright 2025 Dagster Labs, Inc., used under the Apache
License 2.0, the same licence as this repository (see [`LICENSE`](../../LICENSE)).
They are minified and embedded as data URIs. The logos they depict are
trademarks of their respective owners and are used only to identify the
technology an asset uses; no endorsement is implied.
