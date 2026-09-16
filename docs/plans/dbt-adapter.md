# dbt Adapter Plan

Status: planning
Linear issue: DSUI-21
Branch: `feature/dsui-21-create-dbt-adapter`

## Goal

Build one DSUI dbt adapter with two connection methods:

- dbt Cloud, backed by the dbt Administrative API and Cloud artifacts.
- dbt Local, covering the Python dbt v1 engine and the Rust-based Fusion/dbt v2 engine.

Both methods must be operational, not read-only. They must execute work, expose
run state, collect generated artifacts, and provide the dbt documentation
experience in the DSUI shell.

The adapter should share a normalized domain model and page vocabulary while
keeping provider-specific execution, authentication, pagination, artifacts, and
capabilities behind provider clients.

## Product Principles

1. **Operations first.** Users can run, monitor, inspect, cancel, and retry work
   where the provider supports those operations.
2. **dbt is the source of truth.** Do not invent a competing documentation
   taxonomy. The Documentation surface follows the structure, routes, resource
   hierarchy, search, lineage, and detail behavior of the generated dbt Docs or
   Catalog experience.
3. **DSUI owns presentation.** We do not iframe or blindly embed generated HTML.
   We consume the generated data/artifact contract and render the same document
   surface with DSUI components, tokens, and CSS.
4. **Versioned boundaries.** dbt engine versions and artifact schema versions are
   external contracts. Version checks belong in engine detection and artifact
   readers, not throughout page components.
5. **Capabilities over conditionals.** Pages render from an explicit capability
   model and hide or disable unsupported actions with an explanation.
6. **Secrets stay out of stores and UI data.** Tokens, profiles, passwords, and
   credential material belong to the connection/context boundary.

## Supported Modes

### dbt Cloud

The Cloud method connects to a regional/account access URL using an API token.
Personal access tokens are useful for development. Service account tokens with
least-privilege scopes are preferred for production integrations.

Cloud provides:

- account, project, and environment metadata;
- jobs, schedules, commands, triggers, and job settings;
- run history, run status, timing, logs, and artifacts;
- run actions such as trigger, cancel, and retry where the account permissions
  and API route support them;
- optional Discovery API metadata for project state, lineage, model/source/test
  status, and historical metadata.

### dbt Local

The Local method needs an explicit host process-runner contract. It is not just
an artifact importer. The connection config must identify:

- project path;
- profiles directory and target/profile selection;
- dbt executable or managed runtime;
- engine/version detected from `dbt --version`;
- target directory;
- environment variables that are safe and explicitly allowed;
- optional uploaded artifact bundle when execution is not available.

Supported commands for the first implementation:

```text
dbt run
dbt build
dbt test
dbt compile
dbt docs generate
```

The runner must stream output, expose status, preserve the process identity for
cancellation, capture stdout/stderr safely, and ingest output artifacts after a
successful or partially successful command.

The adapter must distinguish at least:

| Engine family | Typical artifact/documentation path | Initial support |
| --- | --- | --- |
| dbt v1 / Python | JSON artifacts and legacy generated docs | Supported |
| dbt v2 / Fusion | v2 generated docs, Parquet/semantic artifacts, newer runtime behavior | Supported through versioned readers and capabilities |
| Unknown or unsupported engine | Provider-specific fallback | Clear unsupported-version error |

The UI must show the detected engine and dbt version. It must not describe all
local installations as "Core" when the executable is Fusion.

## Capability Model

Capabilities are derived from the connection method, engine, dbt version,
artifact versions, permissions, and available APIs.

```ts
type DbtCapabilities = {
  canRun: boolean;
  canBuild: boolean;
  canTest: boolean;
  canCompile: boolean;
  canGenerateDocs: boolean;
  canCancelRun: boolean;
  canRetryRun: boolean;
  canTriggerCloudJob: boolean;
  canManageJobs: boolean;
  canManageEnvironments: boolean;
  hasLiveRunHistory: boolean;
  hasLogs: boolean;
  hasArtifacts: boolean;
  hasColumnCatalog: boolean;
  hasColumnLineage: boolean;
  hasSemanticLayer: boolean;
  hasExposures: boolean;
  hasMetrics: boolean;
  hasSourcesFreshness: boolean;
};
```

The capability result should include a reason for unavailable features, such as
missing command, missing Cloud permission, unsupported artifact schema, or an
unconfigured host process runner.

## Domain Model

The normalized model must preserve source information while presenting a common
UI shape.

### Project

- project name and identifier;
- dbt engine and version;
- adapter/database type;
- source mode: Cloud or Local;
- repository, branch, commit, and package metadata when available;
- generated-at and last-refresh timestamps;
- current documentation/artifact generation state.

### Resource

Use a discriminated resource type rather than treating every item as a model:

- model;
- source;
- seed;
- snapshot;
- test;
- exposure;
- metric or semantic model;
- analysis;
- macro;
- docs block.

Each resource may include description, package, path, tags, group, owner, config,
columns, tests, parents, children, relation, compiled code, and source metadata
when available.

### Run

- provider run ID and local invocation ID;
- command or job name;
- status and normalized status category;
- started/completed timestamps;
- duration;
- trigger/reason;
- environment or target;
- steps and node results;
- logs and error messages;
- associated artifacts;
- cancellable/retryable state.

### Artifact

- artifact kind;
- schema URL/version;
- dbt version and engine;
- generated timestamp and invocation ID;
- source run/job;
- byte size and content type;
- local/remote location;
- parse status and warnings;
- preview/download capability.

Never persist raw credentials, raw profiles, or unbounded raw artifact content
inside an adapter store. A later cache layer may store artifacts deliberately,
with size limits, retention, encryption, and invalidation rules.

## Cloud API Plan

Use API v3 by default. Keep a small v2 compatibility layer for routes that have
not moved to v3. Do not expose v2/v3 details to pages.

All response payloads from dbt Cloud are untrusted external data and must be
validated before normalization or rendering.

### Administrative API resource mapping

The exact route set must be verified against the current regional v3/v2
reference while implementing the client. The following endpoint families are
the contract to cover:

| Capability | API family | UI/resource |
| --- | --- | --- |
| Account details | v3 account routes | connection validation, Overview |
| Projects/environments | v3 account/project/environment routes | project context, Environments |
| Jobs | v2 `GET /api/v2/accounts/{account_id}/jobs/` and job detail | Jobs |
| Trigger job | v2 `POST /api/v2/accounts/{account_id}/jobs/{job_id}/run/` | Run now |
| Retry job | v2 `POST /api/v2/accounts/{account_id}/jobs/{job_id}/rerun/` | Retry job |
| Runs | v2 `GET /api/v2/accounts/{account_id}/runs/` and `GET /api/v2/accounts/{account_id}/runs/{id}/` | Runs |
| Cancel run | v2 `POST /api/v2/accounts/{account_id}/runs/{run_id}/cancel/` | Cancel |
| Retry run | v2 `POST /api/v2/accounts/{account_id}/runs/{run_id}/retry/` | Retry |
| Run logs | v2 run logs/steps routes | Run detail |
| Run artifacts | v2 `GET /api/v2/accounts/{account_id}/runs/{run_id}/artifacts/` and artifact download route | Artifacts, Documentation |
| Job artifacts | v2 job artifact route with optional step | Artifacts, Documentation |
| Webhooks | v3 `/api/v3/accounts/{account_id}/webhooks/subscriptions` | later server integration |

The client must support:

- regional access URLs rather than assuming one global host;
- cursor or offset pagination as required by each route;
- response envelopes and API status codes;
- `401`, `403`, `404`, `409`, `429`, and `5xx` error mapping;
- retry-after handling and bounded exponential backoff;
- request cancellation through the runtime signal;
- permission-aware capability discovery;
- redaction of authorization headers and tokens in logs.

Cloud jobs are multi-step. Every run and artifact reference must preserve the
job ID, run ID, step ID/name, command, and provider status. Artifact downloads
must not follow arbitrary URLs returned by the provider without an allowlisted
Cloud host check and bounded response/content-type validation.

### Discovery API

Discovery is a separate GraphQL client, not another REST resource. It uses an
account-specific metadata endpoint and a Metadata Only service token.

Initial query families:

- environment definition state;
- environment applied state;
- models, sources, tests, seeds, snapshots, exposures, metrics, and macros;
- latest execution info and statuses;
- ancestors and descendants for lineage;
- job-level model/test results when environment state is insufficient;
- cursor-based pagination.

Queries must request bounded fields and page sizes. Avoid fetching raw code,
deep lineage, and catalog columns in one unbounded query. Discovery has separate
rate and complexity limits and limited historical retention, so it is an
optional enrichment layer over the core Admin API/artifact path.

### Cloud webhooks

The later webhook integration may subscribe to:

- `job.run.started`;
- `job.run.completed`;
- `job.run.errored`.

The server endpoint must validate the HMAC signature, deduplicate event IDs,
respond within dbt's timeout, and invalidate/poll affected resources. Webhooks
must not be required for the first working Cloud implementation.

## Local Execution Contract

Local execution cannot remain a single synchronous action when a command can
run longer than the HTTP request. The host therefore needs a durable run
protocol:

```text
startRun(request) -> invocationId
getRun(invocationId) -> Run
listRunEvents(invocationId, cursor?) -> events + nextCursor
cancelRun(invocationId) -> Run
listRunArtifacts(invocationId) -> Artifact[]
getRunArtifact(invocationId, artifactId) -> bounded content/download
```

The server owns invocation records, authorization, persistence, restart
recovery, and cleanup. A client disconnect must not silently terminate a run.
The UI may use event streaming when available and cursor-based polling as the
fallback. `startRun` must accept an idempotency key derived from the user
intent; duplicate starts with the same key must not create duplicate runs.

The lifecycle is:

```text
queued -> running -> cancelling -> cancelled
                    |             |
                    +-> succeeded
                    +-> failed
                    +-> timed_out
```

Provider-native status and messages remain available alongside the normalized
state. Retry is a new invocation linked to the original and is never inferred
from a timeout or an unknown network outcome.

The host must own process execution. The adapter requests an allowed command;
the host decides whether and how it can run.

### Request

- command: one of the supported dbt commands;
- project path or project upload ID;
- profile/target reference, never raw secret material in UI state;
- safe environment variable references;
- selector, vars, full-refresh, defer, and other approved options;
- working directory;
- timeout and cancellation signal.

### Events

- process started with invocation ID;
- stdout/stderr chunks with sensitive values redacted;
- structured log event where available;
- progress/status update;
- artifact discovered;
- process completed with exit code;
- process cancelled or timed out;
- normalized error.

### Security requirements

- no arbitrary command strings from user input;
- command enum plus per-command argument schema;
- canonical executable identity and approved runtime roots;
- canonical project/profile/target paths with traversal and symlink checks;
- explicit environment allowlist and host-side secret handles;
- no raw profile contents in logs or persistent stores;
- secrets passed through the host secret boundary;
- resource limits, timeout, and output-size limits;
- cancellation must terminate the process tree, not only the parent;
- failed execution must not be reported as successful because artifacts exist.

The runner must return bounded output with truncation metadata and redact
secrets before persistence or delivery. Redaction must work across chunk
boundaries. The host must enforce concurrency, timeout, output, disk, and
network policy appropriate for local execution.

## Artifact Compatibility

Artifact readers are registered by artifact kind and schema version. A reader
must validate the schema URL/version, parse only known fields, preserve unknown
fields where safe, and return structured warnings for optional omissions.

### dbt Core v1 artifacts

Support the JSON artifact families used by v1:

- `manifest.json` for project resources and graph maps;
- `catalog.json` for relation/column metadata;
- `run_results.json` for executed node results;
- `sources.json` for source freshness;
- `semantic_manifest.json` where present;
- generated documentation assets where produced.

The initial compatibility matrix should cover the manifest schema versions that
are still encountered in supported Cloud/local projects, starting with v7-v12,
the current run-results schema v6, and the current catalog schema. The matrix
must be maintained as a data table and tested with real fixtures rather than
encoded as assumptions in page code.

### dbt v2/Fusion artifacts

Support the concrete artifact formats produced by the v2 documentation/runtime
flow, including JSON compatibility artifacts, Parquet documentation indexes,
semantic metadata, and Fusion telemetry/OTel Parquet where available. Do not
force v2 output through v1 JSON assumptions. The reader should expose a common
normalized model and retain the original artifact kind/version for diagnostics.

Cloud artifact downloads may be scoped to a run step. The artifact API client
must preserve and pass the step selector and must not accidentally present an
artifact from the last step as the complete run output.

The first release must publish an explicit compatibility matrix. It should name
the supported manifest/catalog/run-results/sources schema versions and the
supported v2/Fusion artifact kinds. Older or unknown versions are visible as
unsupported with a structured warning; they are never silently coerced.

### Partial sets

The UI must work with partial input:

- manifest without catalog: show project metadata but no warehouse columns;
- manifest plus run results: show execution state without catalog statistics;
- catalog without run results: show relation metadata without run health;
- docs output without source freshness: show a freshness unavailable state;
- unsupported optional artifact: show a warning and continue with supported data.

## Information Architecture

The adapter-level navigation is intentionally small:

```text
Overview
Runs
Jobs                  Cloud only
  Environments        Cloud only
Documentation
Artifacts
Settings
```

Models, sources, tests, exposures, metrics, seeds, snapshots, analyses, macros,
and lineage belong to the Documentation surface because that surface mirrors
dbt Docs/Catalog. They should not become an independently invented DSUI asset
taxonomy.

### Overview

The overview is operational, not a replacement for Documentation.

Desktop layout:

- header with adapter identity, connection state, environment/target selector,
  primary run action, and overflow actions;
- KPI strip for models, tests, sources, docs/artifact freshness, and health;
- latest run panel with status, trigger, duration, dbt version, steps, and
  `View run`;
- quick actions adapted to capabilities;
- run status summary and recent runs;
- recent activity timeline.

Mobile layout:

- compact header with connection/target selector;
- primary run action fixed or sticky near the top;
- KPI cards become a horizontal scroll or stacked list;
- latest run and recent runs appear before secondary charts;
- no dense multi-column tables without a responsive alternative.

### Runs

Runs is the main operational page for both modes.

List features:

- status, command/job, environment/target, trigger, duration, and date;
- search and status/date filters;
- pagination or cursor loading;
- active-run emphasis and live refresh;
- run action menu according to capabilities.

Detail features:

- run header with status, command/job, target, trigger, timestamps, and actions;
- step timeline for parse, compile, execute, tests, and docs generation where
  those steps exist;
- node result table with status, duration, message, relation, and compiled code;
- logs with search, level filter, and redaction;
- associated artifacts;
- errors with actionable provider messages.

### Jobs

Cloud-only list and detail. It should cover:

- job name, project, environment, schedule, commands, and last run;
- enabled/paused state;
- job detail with run history;
- `Run now`, cancel, retry, and links to artifacts where permitted;
- settings read/write only where the API contract and permission model support it.

### Environments

Cloud-only nested route under Jobs or Deploy. It should mirror the dbt Cloud
concept rather than invent a generic DSUI environment model:

- environment name and type;
- project and branch/repository context;
- deployment status;
- dbt version/release track;
- latest applied/definition state;
- related jobs and recent runs.

The selected environment belongs in an adapter-scoped persistent store. Local
dbt uses a profile/target selector instead; it should not display a fake Cloud
environment page.

### Documentation

Documentation must be a 1:1 structural and behavioral implementation of the
generated dbt Docs/Catalog surface, with DSUI styling.

Required parity areas:

- project overview;
- resource-type navigation;
- generated routes and deep links;
- search behavior and result grouping;
- resource detail layout;
- columns, descriptions, tests, configs, and metadata;
- DAG/lineage navigation;
- package/project grouping;
- source freshness and catalog information where available;
- exposures and metrics in their native dbt resource categories;
- legacy v1 and v2/Fusion renderer differences.

The first implementation should compare DSUI output against fixture-generated
dbt Docs sites for both v1 and v2/Fusion. CSS may be DSUI-specific, but page
structure and user-facing information architecture must remain dbt-compatible.

### Artifacts

Artifacts is a technical operational surface, separate from Documentation:

- artifact inventory by run and generation;
- kind, schema version, dbt version, engine, and generated time;
- parse state and warnings;
- preview for safe structured JSON/metadata;
- download/open action;
- refresh/import action;
- links back to the producing run and Documentation state.

### Settings

Settings is not a primary workflow page. It is reachable from the connection
selector or overflow menu and contains:

- Cloud access URL, account, and token configuration;
- Local project path, executable/runtime, profile and target;
- artifact source and target directory;
- allowed execution options;
- connection test;
- reset/clear cached adapter state.

## Stores

Persistent adapter-scoped stores may contain:

- selected project, Cloud environment, job, or Local target;
- connection mode;
- artifact source metadata;
- active Documentation resource/filter/search state when it should survive
  navigation;
- selected resource and lineage focus;
- last successful refresh/import;
- parse warnings and capability summary.

Do not persist:

- API tokens;
- password/profile secret values;
- arbitrary environment secrets;
- complete unbounded run history;
- full raw artifacts without an explicit bounded cache design.

Page-scoped stores should hold temporary filters, run forms, command options,
logs view state, and unsaved settings.

## Resource and Action Matrix

| Surface | Cloud | Local v1 | Local Fusion/v2 |
| --- | --- | --- | --- |
| Overview | API/artifacts | local state/artifacts | local state/artifacts |
| Runs | list/detail/trigger/cancel/retry | execute/read results/cancel | execute/read results/cancel |
| Jobs | list/detail/actions | hidden | hidden |
| Environments | list/detail | profile/target selector | profile/target selector |
| Documentation | Cloud artifacts/Discovery | generated legacy docs | generated v2 docs |
| Artifacts | download/inspect | ingest/inspect | ingest/inspect |
| Models/Sources | Discovery/artifacts | manifest/catalog | v2 readers |
| Tests | run results/Discovery | command results | command results |
| Exposures/Metrics | Discovery/artifacts | manifest/semantic artifacts | semantic artifacts |
| Settings | Cloud credentials/config | local runner/config | local runner/config |

## Delivery Order

1. Confirm and document the host process-runner and local filesystem/upload
   contract.
2. Define the normalized domain types, capabilities, artifact reader registry,
   and error model.
3. Add fixture projects and artifacts for dbt v1 and v2/Fusion.
4. Implement Local command execution, cancellation, output capture, and
   artifact ingestion.
5. Implement versioned v1 and v2/Fusion artifact readers.
6. Implement the dbt Docs-compatible Documentation renderer and CSS shell for
   both fixture generations.
7. Implement Cloud authentication and Administrative API client with pagination,
   retries, validation, error mapping, and resource clients.
8. Implement Cloud Jobs, Environments, Runs, actions, logs, and artifacts.
9. Implement shared Overview, Runs, Artifacts, Settings, and capability-aware
   navigation.
10. Add optional Discovery API enrichment after the REST/artifact path is stable.
11. Add webhook invalidation/HMAC handling after polling works reliably.
12. Add tests, manual verification, accessibility checks, responsive checks, and
    documentation for supported engine/artifact versions.

## Testing Strategy

- unit tests for engine/version detection;
- schema fixture tests for every supported artifact reader;
- partial-artifact and unsupported-version tests;
- process-runner tests for arguments, cancellation, timeout, redaction, and
  exit-code mapping;
- Cloud client contract tests for pagination, envelopes, errors, retries, and
  rate limits;
- action tests for trigger/cancel/retry and invalidation;
- renderer fixture tests for v1 and v2/Fusion Documentation structure;
- deep-link and search tests for Documentation routes;
- store hydration/isolation/reset tests;
- responsive and accessibility checks for the main pages;
- manual verification against a real Cloud account and representative local
  projects before release.

## Open Decisions Before Implementation

1. Does the host execute a system-installed dbt binary, a configured project
   runtime, or a managed/containerized runtime?
2. How are local projects supplied: trusted server path, upload, mounted
   workspace, or a local agent?
3. Which credentials may be referenced by a local profile, and where are they
   resolved and redacted?
4. Which v1 artifact schema versions are supported on the first release?
5. Which v2/Fusion documentation and Parquet artifacts are supported initially?
6. Is generated dbt Docs rendered from a compatible data contract, reused from a
   vendored frontend, or reproduced from fixture-observed markup and routes?
7. What is the retention and size policy for run output and artifacts?
8. Which Cloud write operations are enabled for the first release based on API
   permissions and safe retry semantics?
9. Is Discovery API enabled as an optional Cloud enhancement or required for
   specific pages?
10. Which environment/target selection should persist across sessions?

## References

- https://docs.getdbt.com/docs/dbt-apis/admin-api
- https://docs.getdbt.com/docs/dbt-apis/authentication
- https://docs.getdbt.com/docs/dbt-apis/discovery-api
- https://docs.getdbt.com/docs/dbt-apis/discovery-querying
- https://docs.getdbt.com/docs/dbt-apis/rate-limits
- https://docs.getdbt.com/docs/explore/build-and-view-your-docs
- https://docs.getdbt.com/docs/build/documentation
- https://docs.getdbt.com/reference/artifacts/dbt-artifacts
- https://docs.getdbt.com/reference/artifacts/manifest-json
- https://docs.getdbt.com/reference/artifacts/run-results-json
- https://docs.getdbt.com/docs/dbt-versions
- https://docs.getdbt.com/docs/dbt-versions/dbt-version-compatibility
- https://docs.getdbt.com/docs/deploy/webhooks
